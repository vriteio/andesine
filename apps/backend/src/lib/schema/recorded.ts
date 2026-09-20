import { effectiveSchemaRevisions } from "#backend/db/content-schemas";
import type { db } from "#backend/lib/adapters/postgres";
import { contentNodeType } from "#backend/lib/content/validation";
import type { ContentNode } from "#backend/lib/content/document";
import { toSchemaRevisionID, toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import type { ContentSchemaMetadata, SchemaRevision } from "./contract/recorded";
import { contentSchemaInvalidError, type ContentSchemaErrorContext } from "./errors";
import { getResolvedSchemaDefinition } from "./inheritance/resolver";
import { validateContentSchema, type ContentSchemaIssue } from "./validation";

interface RecordedContentInput extends ContentSchemaErrorContext {
  document: ContentNode;
  expectedSchemaHash?: string;
}

type Database = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SchemaRevisionRow = typeof effectiveSchemaRevisions.$inferSelect;

const mapSchemaRevision = (row: SchemaRevisionRow): SchemaRevision => ({
  revisionID: toSchemaRevisionID(row.id),
  hash: row.hash,
  definition: getResolvedSchemaDefinition(row.definition)
});
const loadRecordedSchema = async (
  database: Database,
  workspaceID: string,
  input: ContentSchemaErrorContext,
  status: 409 | 500 = 500
): Promise<SchemaRevision | null> => {
  if (!input.schemaRevisionID) return null;

  const [revision] = await database
    .select()
    .from(effectiveSchemaRevisions)
    .where(
      and(
        eq(effectiveSchemaRevisions.workspaceID, workspaceID),
        eq(effectiveSchemaRevisions.id, toUUID(input.schemaRevisionID))
      )
    );

  if (!revision) {
    throw contentSchemaInvalidError(
      input,
      [
        {
          code: "invalid_schema",
          message: "Recorded schema revision is missing",
          path: ["schema", "revisionID"]
        }
      ],
      status
    );
  }

  return mapSchemaRevision(revision);
};
const assertRecordedContent = async (
  database: Database,
  workspaceID: string,
  input: RecordedContentInput,
  status: 409 | 500 = 500
): Promise<ContentSchemaMetadata | null> => {
  const revision = await loadRecordedSchema(database, workspaceID, input, status);
  return assertRecordedContentRevision(input, revision, status);
};
const assertRecordedContentRevision = (
  input: RecordedContentInput,
  revision: SchemaRevision | null,
  status: 409 | 500 = 500
): ContentSchemaMetadata | null => {
  if (input.schemaRevisionID && !revision) {
    throw contentSchemaInvalidError(
      input,
      [
        {
          code: "invalid_schema",
          message: "Recorded schema revision is missing",
          path: ["schema", "revisionID"]
        }
      ],
      status
    );
  }
  const metadata = revision ? { revisionID: revision.revisionID, hash: revision.hash } : null;

  if (input.expectedSchemaHash !== undefined && input.expectedSchemaHash !== metadata?.hash) {
    throw new ORPCError("CONTENT_SCHEMA_MISMATCH", {
      status: 409,
      message: "Content uses a different schema than expected",
      data: {
        expectedHash: input.expectedSchemaHash,
        actualSchema: metadata,
        hints: [
          "Fetch the recorded definition with schemas.getRevision or content.getSchema, then update the expected hash or select a version with the required schema."
        ]
      }
    });
  }

  const result = revision
    ? validateContentSchema(input.document, revision.definition)
    : contentNodeType.safeParse(input.document);
  const issues: ContentSchemaIssue[] =
    "valid" in result
      ? result.issues
      : result.success
        ? []
        : result.error.issues.map((issue) => ({
            code: "invalid_structure",
            message: issue.message,
            path: issue.path.map((part) => (typeof part === "number" ? part : String(part)))
          }));

  if (!revision && input.document?.type !== "doc") {
    issues.push({
      code: "invalid_structure",
      message: "Content must be a document",
      path: ["type"]
    });
  }

  if (issues.length) throw contentSchemaInvalidError(input, issues, status);

  return metadata;
};

export {
  assertRecordedContentRevision,
  assertRecordedContent,
  loadRecordedSchema,
  mapSchemaRevision
};
