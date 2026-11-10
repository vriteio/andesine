import { contentSchemaMetadataType, schemaHashType } from "../../schema/recorded";
import { CONTENT_SCHEMA_ISSUE_CODES } from "../../schema/issues";
import { publicID } from "../../primitives/id";
import * as z from "zod";
import { assetStatusType } from "./assets";

const errorDataType = z.object({
  hints: z
    .array(z.string())
    .optional()
    .describe(
      "Suggested next steps. Wording can change; use error codes and structured data for program logic."
    )
});
const contentNameConflictErrorDataType = errorDataType.extend({
  name: z.string(),
  slug: z.string().describe("Conflicting URL slug derived from the name"),
  parentID: publicID("coll").nullable()
});
const validationIssueType = z.object({
  message: z.string(),
  code: z.string().optional(),
  path: z
    .array(z.union([z.string(), z.number(), z.object({ key: z.union([z.string(), z.number()]) })]))
    .optional()
});
const validationErrorDataType = errorDataType.extend({
  issues: z.array(validationIssueType).optional()
});
const contentSchemaIssueType = z.object({
  code: z.enum(CONTENT_SCHEMA_ISSUE_CODES),
  message: z.string(),
  path: z.array(z.union([z.string(), z.number()])),
  fieldID: z.string().optional()
});
const contentSchemaInvalidErrorDataType = errorDataType.extend({
  entryID: publicID("ent").optional(),
  versionID: publicID("ver").optional(),
  revisionID: publicID("schr").nullable(),
  issues: z.array(contentSchemaIssueType)
});
const contentSchemaMismatchErrorDataType = errorDataType.extend({
  expectedHash: schemaHashType,
  actualSchema: contentSchemaMetadataType.nullable()
});
const contentFormatInvalidErrorDataType = errorDataType.extend({
  line: z.number().int().optional().describe("Line of the error in the source"),
  column: z.number().int().optional().describe("Column of the error in the source")
});
const contentOperationInvalidErrorDataType = errorDataType.extend({
  index: z.number().int().describe("Index of the operation that failed"),
  reason: z.enum(["not_found", "ambiguous"]).describe("Why the operation's anchor didn't match")
});
const contentPreconditionFailedErrorDataType = errorDataType.extend({
  field: z.string().describe("Expected field that didn't match"),
  current: z.string().nullable().describe("Current value of the field")
});
const contentImageUnavailableErrorDataType = errorDataType.extend({
  url: z.string().describe("Image URL in the content"),
  assetID: z.string().describe("Imported image"),
  assetStatus: z.string().describe("Status of the image when the write stopped waiting")
});
const contentLinkInvalidErrorDataType = errorDataType.extend({
  href: z.string().describe("Link that doesn't point to an entry")
});
const contentHashMismatchErrorDataType = errorDataType.extend({
  hash: z.string().length(64).describe("Hash of the current content"),
  changedIDs: z
    .array(z.string())
    .optional()
    .describe("Entries of a bulk call that kept the change, because they were edited meanwhile")
});
const schemaFieldKeyConflictErrorDataType = errorDataType.extend({
  key: z.string(),
  kind: z.enum(["fragment", "property"]),
  fieldIDs: z.array(z.string())
});
const forbiddenErrorDataType = errorDataType.extend({
  missingPermissions: z.array(z.string()).optional(),
  requiredPlan: z.literal("pro").optional(),
  action: z.string().optional().describe("The requested action that was denied")
});
const rateLimitErrorDataType = errorDataType.extend({
  limit: z
    .enum(["rate", "api-calls", "ai-credits", "spending"])
    .optional()
    .describe(
      "The limit that was reached: a short-term rate limit, or a monthly API call, AI credit, or spending limit"
    ),
  retryAfterSeconds: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Minimum delay before another attempt, in seconds. Also sent in Retry-After.")
});
const schemaMigrationErrorDataType = errorDataType.extend({
  migrationID: publicID("smg")
});
const publishingSnapshotErrorDataType = errorDataType.extend({
  channel: z.string(),
  expectedSnapshotID: publicID("snp"),
  currentSnapshotID: publicID("snp")
});
const assetValidationErrorDataType = validationErrorDataType.extend({
  assetID: publicID("ast").optional(),
  expectedByteSize: z.number().int().nonnegative().optional(),
  actualByteSize: z.number().int().nonnegative().optional(),
  expectedChecksum: z.string().optional(),
  actualChecksum: z.string().optional()
});
const assetConflictErrorDataType = errorDataType.extend({
  assetID: publicID("ast").optional(),
  assetStatus: assetStatusType.optional()
});
const assetStorageErrorDataType = forbiddenErrorDataType.extend({
  limitBytes: z.number().int().nonnegative().optional(),
  usedBytes: z.number().int().nonnegative().optional(),
  requiredBytes: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Additional space reserved for this upload, including processed image variants")
});
const membershipExistsErrorDataType = errorDataType.extend({ membershipID: publicID("ms") });
const invitePendingErrorDataType = errorDataType.extend({ inviteID: publicID("inv") });

export {
  contentNameConflictErrorDataType,
  contentSchemaIssueType,
  contentSchemaInvalidErrorDataType,
  contentSchemaMismatchErrorDataType,
  contentFormatInvalidErrorDataType,
  contentHashMismatchErrorDataType,
  contentImageUnavailableErrorDataType,
  contentLinkInvalidErrorDataType,
  contentPreconditionFailedErrorDataType,
  contentOperationInvalidErrorDataType,
  schemaFieldKeyConflictErrorDataType,
  assetValidationErrorDataType,
  assetConflictErrorDataType,
  assetStorageErrorDataType,
  errorDataType,
  validationIssueType,
  validationErrorDataType,
  forbiddenErrorDataType,
  rateLimitErrorDataType,
  schemaMigrationErrorDataType,
  publishingSnapshotErrorDataType,
  membershipExistsErrorDataType,
  invitePendingErrorDataType
};
