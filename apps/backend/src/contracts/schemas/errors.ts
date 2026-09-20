import { contentSchemaMetadataType, schemaHashType } from "#backend/lib/schema/contract/recorded";
import { CONTENT_SCHEMA_ISSUE_CODES } from "#backend/lib/schema/validation";
import { publicID } from "#backend/lib/primitives";
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
