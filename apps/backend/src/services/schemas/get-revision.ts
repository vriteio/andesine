import { effectiveSchemaRevisions } from "@andesine/server/database";
import { mapSchemaRevision } from "@andesine/server/schema";
import { type ServiceResolveContext, withAuthorization } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { type SchemaRevision } from "@andesine/contracts/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

interface GetSchemaRevisionInput {
  revisionID: string;
}

type SchemaRevisionRow = typeof effectiveSchemaRevisions.$inferSelect;

const resolveSchemaRevision = async ({
  database,
  input,
  workspaceID
}: ServiceResolveContext<GetSchemaRevisionInput>): Promise<SchemaRevisionRow> => {
  const [revision] = await database
    .select()
    .from(effectiveSchemaRevisions)
    .where(
      and(
        eq(effectiveSchemaRevisions.workspaceID, workspaceID),
        eq(effectiveSchemaRevisions.id, toUUID(input.revisionID))
      )
    );

  if (!revision) throw new ORPCError("NOT_FOUND", { message: "Schema revision not found" });

  return revision;
};
const getSchemaRevision = withAuthorization<
  GetSchemaRevisionInput,
  SchemaRevisionRow,
  SchemaRevision
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:read", collectionID: resolved.collectionID }]
    }),
    includeDeleted: true,
    resolve: resolveSchemaRevision
  },
  async ({ resolved }) => mapSchemaRevision(resolved)
);

export { getSchemaRevision };
