import { collectionSchemas, schemaMigrationCollections, schemaMigrations } from "#backend/db";
import type { ServiceResolveContext } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

interface GetSchemaMigrationInput {
  migrationID: string;
}
interface ResolvedSchemaMigration {
  collectionID: string;
  migration: typeof schemaMigrations.$inferSelect;
}

const resolveSchemaMigration = async ({
  database,
  input,
  workspaceID
}: ServiceResolveContext<GetSchemaMigrationInput>): Promise<ResolvedSchemaMigration> => {
  const [migration] = await database
    .select()
    .from(schemaMigrations)
    .where(
      and(
        eq(schemaMigrations.id, toUUID(input.migrationID)),
        eq(schemaMigrations.workspaceID, workspaceID)
      )
    );

  if (!migration) throw new ORPCError("NOT_FOUND", { message: "Schema migration not found" });

  const [localSchema] = migration.schemaID
    ? await database
        .select({ collectionID: collectionSchemas.collectionID })
        .from(collectionSchemas)
        .where(
          and(
            eq(collectionSchemas.workspaceID, workspaceID),
            eq(collectionSchemas.id, migration.schemaID)
          )
        )
        .limit(1)
    : [];
  const [affectedCollection] = localSchema
    ? []
    : await database
        .select({ collectionID: schemaMigrationCollections.collectionID })
        .from(schemaMigrationCollections)
        .where(
          and(
            eq(schemaMigrationCollections.workspaceID, workspaceID),
            eq(schemaMigrationCollections.migrationID, migration.id)
          )
        )
        .limit(1);
  const collectionID = localSchema?.collectionID || affectedCollection?.collectionID;

  if (!collectionID) throw new ORPCError("NOT_FOUND", { message: "Schema migration not found" });

  return { collectionID, migration };
};
export { resolveSchemaMigration };
export type { GetSchemaMigrationInput, ResolvedSchemaMigration };
