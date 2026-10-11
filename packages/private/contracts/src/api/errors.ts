import {
  errorDataType,
  contentNameConflictErrorDataType,
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
  forbiddenErrorDataType,
  invitePendingErrorDataType,
  membershipExistsErrorDataType,
  publishingSnapshotErrorDataType,
  rateLimitErrorDataType,
  schemaMigrationErrorDataType,
  validationErrorDataType
} from "./schemas/errors";

const commonErrors = {
  BAD_REQUEST: { data: validationErrorDataType.optional() },
  UNAUTHORIZED: { data: errorDataType.optional() },
  FORBIDDEN: { data: forbiddenErrorDataType.optional() },
  NOT_FOUND: { data: errorDataType.optional() },
  CONFLICT: { data: errorDataType.optional() },
  TOO_MANY_REQUESTS: { data: rateLimitErrorDataType.optional() },
  INTERNAL_SERVER_ERROR: { data: errorDataType.optional() },
  SERVICE_UNAVAILABLE: { data: errorDataType.optional() }
};
const contentNameErrors = {
  CONTENT_NAME_CONFLICT: { status: 409, data: contentNameConflictErrorDataType }
};
const assetErrors = {
  BAD_REQUEST: { data: assetValidationErrorDataType.optional() },
  CONFLICT: { data: assetConflictErrorDataType.optional() },
  FORBIDDEN: { data: assetStorageErrorDataType.optional() }
};
const contentDeliveryErrors = {
  CONTENT_SCHEMA_INVALID: { status: 500, data: contentSchemaInvalidErrorDataType }
};
const contentReadErrors = {
  ...contentDeliveryErrors,
  CONTENT_SCHEMA_MISMATCH: { status: 409, data: contentSchemaMismatchErrorDataType }
};
const contentPublicationErrors = {
  CONTENT_SCHEMA_INVALID: { status: 409, data: contentSchemaInvalidErrorDataType }
};
const contentFormatErrors = {
  CONTENT_FORMAT_INVALID: { status: 400, data: contentFormatInvalidErrorDataType },
  CONTENT_LINK_INVALID: { status: 409, data: contentLinkInvalidErrorDataType },
  CONTENT_IMAGE_UNAVAILABLE: { status: 409, data: contentImageUnavailableErrorDataType }
};
const contentPreconditionErrors = {
  CONTENT_PRECONDITION_FAILED: { status: 409, data: contentPreconditionFailedErrorDataType }
};
const idempotencyErrors = {
  IDEMPOTENCY_KEY_IN_PROGRESS: {
    status: 409,
    message: "A request with this Idempotency-Key is in progress",
    data: errorDataType
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    message: "This Idempotency-Key was used with a different request",
    data: errorDataType
  }
};
const contentWriteErrors = {
  ...contentPublicationErrors,
  CONTENT_HASH_MISMATCH: { status: 409, data: contentHashMismatchErrorDataType },
  CONTENT_OPERATION_INVALID: { status: 409, data: contentOperationInvalidErrorDataType }
};
const schemaMigrationErrors = {
  SCHEMA_FIELD_KEY_CONFLICT: { status: 409, data: schemaFieldKeyConflictErrorDataType },
  SCHEMA_MIGRATION_IN_PROGRESS: {
    status: 409,
    message: "A schema migration is in progress for this collection",
    data: schemaMigrationErrorDataType
  }
};
const publishingSnapshotErrors = {
  PUBLISHING_NAME_CONFLICT: { status: 409, data: contentNameConflictErrorDataType },
  PUBLISHING_SNAPSHOT_CHANGED: {
    status: 409,
    message: "Publishing snapshot changed",
    data: publishingSnapshotErrorDataType
  }
};
const roleNameErrors = {
  ROLE_NAME_DUPLICATE: { status: 409, data: errorDataType.optional() },
  ROLE_NAME_INVALID: { status: 400, data: validationErrorDataType.optional() }
};
const membershipInviteErrors = {
  MEMBERSHIP_ALREADY_EXISTS: { status: 409, data: membershipExistsErrorDataType },
  INVITE_ALREADY_PENDING: { status: 409, data: invitePendingErrorDataType }
};

export {
  contentNameErrors,
  contentDeliveryErrors,
  contentReadErrors,
  contentPublicationErrors,
  contentFormatErrors,
  contentPreconditionErrors,
  contentWriteErrors,
  idempotencyErrors,
  commonErrors,
  assetErrors,
  schemaMigrationErrors,
  publishingSnapshotErrors,
  roleNameErrors,
  membershipInviteErrors
};
