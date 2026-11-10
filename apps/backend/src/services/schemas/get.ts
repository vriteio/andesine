import {
  effectiveSchemaRevisions,
  schemaVersionContributors,
  schemaVersions
} from "@andesine/server/database";
import { loadCurrentContentPaths } from "@andesine/server/content";
import { type CollectionSelector } from "@andesine/contracts/content";
import { toCollectionID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import {
  mapEffectiveCollectionSchema,
  mapLocalCollectionSchema,
  mapSchemaVersionSummary
} from "#backend/lib/data";
import { type CollectionSchemaDetails } from "@andesine/contracts/schema";
import { withAuthorization } from "#backend/lib/policy";
import { and, eq } from "drizzle-orm";
import { resolveLocalCollectionSchema } from "./resolve";

type ResolvedCollectionSchema = Awaited<ReturnType<typeof resolveLocalCollectionSchema>> & {
  scopeID: string | null;
};

const getCollectionSchema = withAuthorization<
  CollectionSelector,
  ResolvedCollectionSchema,
  CollectionSchemaDetails
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:read", collectionID: resolved.scopeID }]
    }),
    transaction: "atomic",
    resolve: async (context) => {
      const paths = await loadCurrentContentPaths(context.database, context.workspaceID);
      const scopeID = paths.resolveCollection(context.input) ?? null;

      if (!scopeID) {
        if (!paths.rootID) throw new ORPCError("NOT_FOUND");
        return { collection: { id: paths.rootID }, schema: null, scopeID };
      }

      return {
        ...(await resolveLocalCollectionSchema({
          ...context,
          input: { collectionID: toCollectionID(scopeID) }
        })),
        scopeID
      };
    }
  },
  async ({ database, resolved, workspaceID }) => {
    const [effectiveRevision] = await database
      .select()
      .from(effectiveSchemaRevisions)
      .where(
        and(
          eq(effectiveSchemaRevisions.workspaceID, workspaceID),
          eq(effectiveSchemaRevisions.collectionID, resolved.collection.id),
          eq(effectiveSchemaRevisions.active, true)
        )
      );
    const [activeVersion] = resolved.schema
      ? await database
          .select()
          .from(schemaVersions)
          .where(
            and(
              eq(schemaVersions.workspaceID, workspaceID),
              eq(schemaVersions.schemaID, resolved.schema.id),
              eq(schemaVersions.active, true)
            )
          )
      : [];
    const contributors = activeVersion
      ? await database
          .select({ membershipID: schemaVersionContributors.membershipID })
          .from(schemaVersionContributors)
          .where(
            and(
              eq(schemaVersionContributors.workspaceID, workspaceID),
              eq(schemaVersionContributors.versionID, activeVersion.id)
            )
          )
      : [];
    const mappedActiveVersion = activeVersion
      ? mapSchemaVersionSummary(
          activeVersion,
          resolved.collection.id,
          contributors.map(({ membershipID }) => membershipID)
        )
      : null;

    return {
      local: resolved.schema
        ? mapLocalCollectionSchema({ row: resolved.schema, activeVersion: mappedActiveVersion })
        : null,
      effective: effectiveRevision
        ? mapEffectiveCollectionSchema(effectiveRevision, !activeVersion)
        : null
    };
  }
);

export { getCollectionSchema };
