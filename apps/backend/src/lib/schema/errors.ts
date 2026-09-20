import { ORPCError } from "@orpc/server";
import { toEntryID, toSchemaRevisionID, toUUID, toVersionID } from "#backend/lib/primitives";
import { getSchemaFieldKeyConflicts } from "./contract/keys";
import type { SchemaField } from "./contract/definition";
import type { ContentSchemaIssue } from "./validation";

interface ContentSchemaErrorContext {
  entryID?: string;
  versionID?: string;
  schemaRevisionID: string | null;
}

const contentSchemaInvalidError = (
  input: ContentSchemaErrorContext,
  issues: ContentSchemaIssue[],
  status: 409 | 500 = 500
) => {
  return new ORPCError("CONTENT_SCHEMA_INVALID", {
    status,
    message: "Content does not match its recorded schema or document structure",
    data: {
      ...(input.entryID && { entryID: toEntryID(toUUID(input.entryID)) }),
      ...(input.versionID && { versionID: toVersionID(toUUID(input.versionID)) }),
      revisionID: input.schemaRevisionID
        ? toSchemaRevisionID(toUUID(input.schemaRevisionID))
        : null,
      issues,
      hints: [
        status === 409
          ? "Correct the fields listed in issues before publishing. Saved versions must be corrected in a new version."
          : "Use the recorded schema revision and issue paths to inspect this content. Correct the source and publish a new version; historical content is not repaired on read."
      ]
    }
  });
};
const assertSchemaFieldKeys = (fields: Array<SchemaField>): void => {
  const [conflict] = getSchemaFieldKeyConflicts(fields);

  if (!conflict) return;

  throw new ORPCError("SCHEMA_FIELD_KEY_CONFLICT", {
    status: 409,
    message: `Schema ${conflict.kind} key "${conflict.key}" is duplicated`,
    data: {
      ...conflict,
      hints: [
        "Change one of the conflicting field labels. Keys must be unique within each field kind, including inherited fields."
      ]
    }
  });
};

export { assertSchemaFieldKeys, contentSchemaInvalidError };
export type { ContentSchemaErrorContext };
