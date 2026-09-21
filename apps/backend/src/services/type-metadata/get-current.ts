import {
  collections,
  entries,
  contents,
  effectiveSchemaRevisions,
  schemaMigrationCollections,
  schemaMigrations
} from "#backend/db";
import type { TypeMetadataInput, TypeMetadata } from "#backend/contracts/schemas/type-metadata";
import { withAuthorization } from "#backend/lib/policy";
import { toSchemaMigrationID } from "#backend/lib/primitives";
import { selectMetadataCollections } from "#backend/lib/type-metadata/selection";
import { createMetadataResult } from "#backend/lib/type-metadata/result";
import { loadMetadataRevisions } from "#backend/lib/type-metadata/revisions";
import { mapSchemaRevision } from "#backend/lib/schema/recorded";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

const getCurrent = withAuthorization<TypeMetadataInput, undefined, TypeMetadata>(
  {
    tree: true,
    transaction: "snapshot",
    permissions: (input) => ({
      session: true,
      key:
        input.includeEntries || input.includeTree
          ? ["read:collections", "read:entries"]
          : ["read:collections"]
    })
  },
  async ({ database, input, auth, authorization, workspaceID }) => {
    const rows = await database
      .select({
        id: collections.id,
        parentID: collections.parentID,
        name: collections.name,
        rank: collections.rank
      })
      .from(collections)
      .where(and(eq(collections.workspaceID, workspaceID), isNull(collections.deletedAt)));
    const rootID = rows.find((row) => row.parentID === null)?.id;
    const selected = selectMetadataCollections({
      rows,
      selectors: input.collections,
      rootID,
      authorization
    });
    const selectedIDs = selected.collections.flatMap((row) => (row.id ? [row.id] : []));
    const [migration] = selectedIDs.length
      ? await database
          .select({ id: schemaMigrations.id })
          .from(schemaMigrationCollections)
          .innerJoin(
            schemaMigrations,
            and(
              eq(schemaMigrations.workspaceID, schemaMigrationCollections.workspaceID),
              eq(schemaMigrations.id, schemaMigrationCollections.migrationID)
            )
          )
          .where(
            and(
              eq(schemaMigrationCollections.workspaceID, workspaceID),
              inArray(schemaMigrationCollections.collectionID, selectedIDs),
              inArray(schemaMigrations.status, ["queued", "running", "rolling_back"])
            )
          )
          .limit(1)
      : [];

    if (migration) {
      throw new ORPCError("SCHEMA_MIGRATION_IN_PROGRESS", {
        status: 409,
        message:
          "Type metadata is unavailable while a selected collection's schema migration is in progress",
        data: {
          migrationID: toSchemaMigrationID(migration.id),
          hints: ["Wait for the migration to finish, then request current type metadata again."]
        }
      });
    }

    const revisions = selectedIDs.length
      ? await database
          .select()
          .from(effectiveSchemaRevisions)
          .where(
            and(
              eq(effectiveSchemaRevisions.workspaceID, workspaceID),
              inArray(effectiveSchemaRevisions.collectionID, selectedIDs),
              eq(effectiveSchemaRevisions.active, true)
            )
          )
      : [];
    const revisionsByCollection = new Map(revisions.map((row) => [row.collectionID, row.id]));
    const includeRoot = selected.collections.some((row) => row.id === null);
    const includeEntries = input.includeEntries || input.includeTree;
    const entryRows =
      includeEntries && (selectedIDs.length || includeRoot)
        ? await database
            .select({
              id: entries.id,
              collectionID: entries.collectionID,
              name: entries.name,
              rank: entries.rank,
              schemaRevisionID: contents.schemaRevisionID
            })
            .from(entries)
            .leftJoin(
              contents,
              and(eq(contents.entryID, entries.id), eq(contents.workspaceID, workspaceID))
            )
            .where(
              and(
                eq(entries.workspaceID, workspaceID),
                isNull(entries.deletedAt),
                or(
                  selectedIDs.length ? inArray(entries.collectionID, selectedIDs) : undefined,
                  includeRoot ? isNull(entries.collectionID) : undefined,
                  includeRoot && rootID ? eq(entries.collectionID, rootID) : undefined
                )
              )
            )
        : [];
    const metadataEntries = entryRows
      .map((row) => ({
        ...row,
        collectionID: row.collectionID === rootID ? null : row.collectionID
      }))
      .filter((row) => authorization.canEntry(row.collectionID, "entry:read"));
    const revisionIDs = new Set(revisions.map((row) => row.id));
    // Reverted entries can retain recorded revisions other than the collection's active revision.
    const recordedRevisions = await loadMetadataRevisions(
      database,
      workspaceID,
      metadataEntries.flatMap((row) =>
        row.schemaRevisionID && !revisionIDs.has(row.schemaRevisionID) ? [row.schemaRevisionID] : []
      )
    );

    return createMetadataResult({
      workspaceID: auth.workspaceID,
      source: { kind: "current" },
      options: input,
      ...selected,
      associations: selected.collections.map((row) => ({
        collectionID: row.id,
        schemaRevisionID: row.id ? (revisionsByCollection.get(row.id) ?? null) : null
      })),
      revisions: [...revisions.map(mapSchemaRevision), ...recordedRevisions],
      entries: metadataEntries
    });
  }
);

export { getCurrent };
