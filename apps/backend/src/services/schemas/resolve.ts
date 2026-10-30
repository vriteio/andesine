import { collections, collectionSchemas } from "@andesine/server/database";
import { type ServiceResolveContext } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

interface CollectionSchemaInput {
  collectionID: string;
}

const resolveSchemaCollection = async ({
  database,
  input,
  workspaceID
}: ServiceResolveContext<CollectionSchemaInput>) => {
  const [collection] = await database
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.id, toUUID(input.collectionID)),
        eq(collections.workspaceID, workspaceID),
        isNotNull(collections.parentID),
        isNull(collections.deletedAt)
      )
    );

  if (!collection) throw new ORPCError("NOT_FOUND", { message: "Collection not found" });

  return collection;
};
const resolveLocalCollectionSchema = async (
  context: ServiceResolveContext<CollectionSchemaInput>
): Promise<{
  collection: { id: string };
  schema: typeof collectionSchemas.$inferSelect | null;
}> => {
  const collection = await resolveSchemaCollection(context);
  const [schema] = await context.database
    .select()
    .from(collectionSchemas)
    .where(
      and(
        eq(collectionSchemas.workspaceID, context.workspaceID),
        eq(collectionSchemas.collectionID, collection.id)
      )
    );

  return { collection, schema: schema || null };
};

/** The enabled schema of a live collection, locked if the caller has a transaction. */
const resolveEnabledSchema = async ({
  database,
  input,
  workspaceID
}: ServiceResolveContext<{ schemaID: string }>) => {
  const [schema] = await database
    .select({ id: collectionSchemas.id, collectionID: collectionSchemas.collectionID })
    .from(collectionSchemas)
    .innerJoin(
      collections,
      and(
        eq(collections.workspaceID, collectionSchemas.workspaceID),
        eq(collections.id, collectionSchemas.collectionID),
        isNotNull(collections.parentID),
        isNull(collections.deletedAt)
      )
    )
    .where(
      and(
        eq(collectionSchemas.id, toUUID(input.schemaID)),
        eq(collectionSchemas.workspaceID, workspaceID),
        eq(collectionSchemas.enabled, true)
      )
    )
    .for("update");

  if (!schema) throw new ORPCError("NOT_FOUND", { message: "Schema not found" });

  return schema;
};

type ResolvedEnabledSchema = Awaited<ReturnType<typeof resolveEnabledSchema>>;

export { resolveEnabledSchema, resolveLocalCollectionSchema, resolveSchemaCollection };
export type { CollectionSchemaInput, ResolvedEnabledSchema };
