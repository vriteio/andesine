import { effectiveSchemaRevisions } from "#backend/db/content-schemas";
import { type ServiceResolveContext, withAuthorization } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import type { SchemaRevision } from "#backend/lib/schema/contract/recorded";
import { mapSchemaRevision } from "#backend/lib/schema/recorded";
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
