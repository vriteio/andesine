import {
  answerEventType,
  publishedAnswerEventType,
  publishedSearchResultItemType,
  answerSourceType,
  publishedAnswerSourceType,
  askResultType,
  publishedAskResultType,
  historyMessageType
} from "./search";
import { publicCollectionType } from "./collections";
import {
  contentSchemaMetadataType,
  schemaRevisionType
} from "#backend/lib/schema/contract/recorded";
import {
  publishedEntryContentType,
  publishedEntrySummaryType,
  publishedCollectionSummaryType
} from "./content";
import { instanceInfoType } from "./instance";
import {
  errorDataType,
  contentNameConflictErrorDataType,
  contentSchemaIssueType,
  contentSchemaInvalidErrorDataType,
  contentSchemaMismatchErrorDataType,
  schemaFieldKeyConflictErrorDataType,
  assetValidationErrorDataType,
  assetConflictErrorDataType,
  assetStorageErrorDataType,
  validationIssueType,
  validationErrorDataType,
  forbiddenErrorDataType,
  rateLimitErrorDataType,
  schemaMigrationErrorDataType,
  publishingSnapshotErrorDataType,
  membershipExistsErrorDataType,
  invitePendingErrorDataType
} from "./errors";
import type { OpenAPIGeneratorGenerateOptions } from "@orpc/openapi";
import { roleType, permissionType, baseRoleType } from "#backend/db/roles";
import { inviteStatusType } from "#backend/db/invitations";
import { userProfileType } from "#backend/db/users";
import { contentNodeType, contentMarkType } from "#backend/lib/content/validation";
import {
  versionDetailsType,
  versionSummaryType,
  versionReasonType
} from "#backend/lib/data/entry-version";
import {
  collectionSchemaDetailsType,
  localCollectionSchemaType,
  effectiveCollectionSchemaType,
  schemaVersionDetailsType,
  schemaVersionSummaryType,
  schemaApplicationResultType,
  schemaMigrationDetailsType,
  schemaMigrationStatusType,
  schemaMigrationContentLossEntryType
} from "#backend/lib/data/content-schema";
import {
  schemaDefinitionType,
  schemaDraftDefinitionType,
  schemaFieldType,
  schemaPropertyType,
  schemaPropertyValueType,
  schemaFragmentType,
  schemaBlockType
} from "#backend/lib/schema/contract/definition";
import {
  resolvedSchemaDefinitionType,
  resolvedSchemaFieldType,
  schemaFieldSourceType
} from "#backend/lib/schema/inheritance/resolver";
import { publishingChannelCodeType } from "#backend/lib/publishing/channel";
import {
  entryDetailsType,
  entrySummaryType,
  entryFragmentType,
  entryPropertyType,
  entryPropertyKindType,
  entryPropertyValueType
} from "./entries";
import { paginationType } from "./pagination";
import {
  assetDetailsType,
  assetAnalysisType,
  assetAnalysisStatusType,
  assetStatusType,
  assetFileType,
  assetFileFormatType,
  assetVariantType,
  assetSearchResultType,
  assetUploadRegistrationType
} from "./assets";
import {
  memberDetailsType,
  inviteDetailsType,
  membershipInviteResultType,
  inviteDeliveryResultType
} from "./memberships";
import {
  publishedContentType,
  publishedAssetType,
  publishedTreeEntryType,
  publishedTreeVersionType,
  publishedTreeCollectionType,
  publishedTreeType
} from "./content";
import {
  publishingChannelType,
  publishingChannelListItemType,
  entryPublicationType,
  entryPublicationChannelType,
  channelContentType,
  channelContentEntryType,
  channelContentCollectionType,
  channelContentStatusType,
  publishEntryTargetType,
  revertPublishingChangesResultType,
  publishedEntriesResultType,
  unpublishedEntriesResultType
} from "./publishing";
import {
  propertyFilterType,
  textPropertyFilterType,
  numberPropertyFilterType,
  booleanPropertyFilterType,
  datePropertyFilterType,
  comparisonOperatorType,
  propertyValueType,
  searchResultItemType,
  searchResultType
} from "./search";

// Names in this registry become public SDK type names.
const publicSchemas = {
  AnswerEvent: { schema: answerEventType, strategy: "output" },
  PublishedAnswerEvent: { schema: publishedAnswerEventType, strategy: "output" },
  AnswerSource: { schema: answerSourceType, strategy: "output" },
  PublishedAnswerSource: { schema: publishedAnswerSourceType, strategy: "output" },
  Answer: { schema: askResultType, strategy: "output" },
  PublishedAnswer: { schema: publishedAskResultType, strategy: "output" },
  AnswerHistoryMessage: { schema: historyMessageType, strategy: "input" },
  ContentSchemaMetadata: { schema: contentSchemaMetadataType, strategy: "output" },
  SchemaRevision: { schema: schemaRevisionType, strategy: "output" },
  ContentSchemaIssue: { schema: contentSchemaIssueType, strategy: "output" },
  ContentSchemaInvalidErrorData: { schema: contentSchemaInvalidErrorDataType, strategy: "output" },
  ContentSchemaMismatchErrorData: {
    schema: contentSchemaMismatchErrorDataType,
    strategy: "output"
  },
  SchemaFieldKeyConflictErrorData: {
    schema: schemaFieldKeyConflictErrorDataType,
    strategy: "output"
  },
  PublishedEntryContent: { schema: publishedEntryContentType, strategy: "output" },
  PublishedEntrySummary: { schema: publishedEntrySummaryType, strategy: "output" },
  PublishedCollectionSummary: { schema: publishedCollectionSummaryType, strategy: "output" },
  InstanceInfo: { schema: instanceInfoType, strategy: "output" },
  AssetValidationErrorData: { schema: assetValidationErrorDataType, strategy: "output" },
  AssetConflictErrorData: { schema: assetConflictErrorDataType, strategy: "output" },
  AssetStorageErrorData: { schema: assetStorageErrorDataType, strategy: "output" },
  ContentNameConflictErrorData: { schema: contentNameConflictErrorDataType, strategy: "output" },
  ErrorData: { schema: errorDataType, strategy: "output" },
  ValidationIssue: { schema: validationIssueType, strategy: "output" },
  ValidationErrorData: { schema: validationErrorDataType, strategy: "output" },
  ForbiddenErrorData: { schema: forbiddenErrorDataType, strategy: "output" },
  RateLimitErrorData: { schema: rateLimitErrorDataType, strategy: "output" },
  SchemaMigrationErrorData: { schema: schemaMigrationErrorDataType, strategy: "output" },
  PublishingSnapshotErrorData: { schema: publishingSnapshotErrorDataType, strategy: "output" },
  MembershipExistsErrorData: { schema: membershipExistsErrorDataType, strategy: "output" },
  InvitePendingErrorData: { schema: invitePendingErrorDataType, strategy: "output" },

  EntrySummary: { schema: entrySummaryType, strategy: "output" },
  Collection: { schema: publicCollectionType, strategy: "output" },
  Role: { schema: roleType, strategy: "output" },
  Permission: { schema: permissionType, strategy: "output" },
  BaseRole: { schema: baseRoleType, strategy: "output" },
  InviteStatus: { schema: inviteStatusType, strategy: "output" },
  UserProfile: { schema: userProfileType, strategy: "output" },
  ContentNode: { schema: contentNodeType, strategy: "output" },
  ContentNodeInput: { schema: contentNodeType, strategy: "input" },
  ContentMark: { schema: contentMarkType, strategy: "output" },
  ContentMarkInput: { schema: contentMarkType, strategy: "input" },
  EntryVersion: { schema: versionDetailsType, strategy: "output" },
  EntryVersionSummary: { schema: versionSummaryType, strategy: "output" },
  VersionReason: { schema: versionReasonType, strategy: "output" },
  CollectionSchema: { schema: collectionSchemaDetailsType, strategy: "output" },
  LocalCollectionSchema: { schema: localCollectionSchemaType, strategy: "output" },
  EffectiveCollectionSchema: { schema: effectiveCollectionSchemaType, strategy: "output" },
  SchemaVersion: { schema: schemaVersionDetailsType, strategy: "output" },
  SchemaVersionSummary: { schema: schemaVersionSummaryType, strategy: "output" },
  SchemaApplicationResult: { schema: schemaApplicationResultType, strategy: "output" },
  SchemaMigration: { schema: schemaMigrationDetailsType, strategy: "output" },
  SchemaMigrationStatus: { schema: schemaMigrationStatusType, strategy: "output" },
  SchemaMigrationContentLossEntry: {
    schema: schemaMigrationContentLossEntryType,
    strategy: "output"
  },
  SchemaDefinition: { schema: schemaDefinitionType, strategy: "output" },
  SchemaDraftDefinition: { schema: schemaDraftDefinitionType, strategy: "output" },
  SchemaField: { schema: schemaFieldType, strategy: "output" },
  SchemaProperty: { schema: schemaPropertyType, strategy: "output" },
  SchemaPropertyValue: { schema: schemaPropertyValueType, strategy: "output" },
  SchemaFragment: { schema: schemaFragmentType, strategy: "output" },
  SchemaBlockType: { schema: schemaBlockType, strategy: "output" },
  ResolvedSchemaDefinition: { schema: resolvedSchemaDefinitionType, strategy: "output" },
  ResolvedSchemaField: { schema: resolvedSchemaFieldType, strategy: "output" },
  SchemaFieldSource: { schema: schemaFieldSourceType, strategy: "output" },
  PublishingChannelCode: { schema: publishingChannelCodeType, strategy: "output" },
  Entry: { schema: entryDetailsType, strategy: "output" },
  EntryFragment: { schema: entryFragmentType, strategy: "output" },
  EntryProperty: { schema: entryPropertyType, strategy: "output" },
  EntryPropertyKind: { schema: entryPropertyKindType, strategy: "output" },
  EntryPropertyValue: { schema: entryPropertyValueType, strategy: "output" },
  Pagination: { schema: paginationType, strategy: "output" },
  Asset: { schema: assetDetailsType, strategy: "output" },
  AssetAnalysis: { schema: assetAnalysisType, strategy: "output" },
  AssetAnalysisStatus: { schema: assetAnalysisStatusType, strategy: "output" },
  AssetStatus: { schema: assetStatusType, strategy: "output" },
  AssetFile: { schema: assetFileType, strategy: "output" },
  AssetFileFormat: { schema: assetFileFormatType, strategy: "output" },
  AssetVariant: { schema: assetVariantType, strategy: "output" },
  AssetSearchResult: { schema: assetSearchResultType, strategy: "output" },
  AssetUploadRegistration: { schema: assetUploadRegistrationType, strategy: "output" },
  Membership: { schema: memberDetailsType, strategy: "output" },
  Invite: { schema: inviteDetailsType, strategy: "output" },
  MembershipInviteResult: { schema: membershipInviteResultType, strategy: "output" },
  InviteDeliveryResult: { schema: inviteDeliveryResultType, strategy: "output" },
  PublishedContent: { schema: publishedContentType, strategy: "output" },
  PublishedAsset: { schema: publishedAssetType, strategy: "output" },
  PublishedEntry: { schema: publishedTreeEntryType, strategy: "output" },
  PublishedVersion: { schema: publishedTreeVersionType, strategy: "output" },
  PublishedCollection: { schema: publishedTreeCollectionType, strategy: "output" },
  PublishedTree: { schema: publishedTreeType, strategy: "output" },
  PublishingChannel: { schema: publishingChannelType, strategy: "output" },
  PublishingChannelListItem: { schema: publishingChannelListItemType, strategy: "output" },
  EntryPublication: { schema: entryPublicationType, strategy: "output" },
  EntryPublicationChannel: { schema: entryPublicationChannelType, strategy: "output" },
  ChannelContent: { schema: channelContentType, strategy: "output" },
  ChannelContentEntry: { schema: channelContentEntryType, strategy: "output" },
  ChannelContentCollection: { schema: channelContentCollectionType, strategy: "output" },
  ChannelContentStatus: { schema: channelContentStatusType, strategy: "output" },
  PublishEntryTarget: { schema: publishEntryTargetType, strategy: "input" },
  RevertPublishingChangesResult: { schema: revertPublishingChangesResultType, strategy: "output" },
  PublishedEntriesResult: { schema: publishedEntriesResultType, strategy: "output" },
  UnpublishedEntriesResult: { schema: unpublishedEntriesResultType, strategy: "output" },
  PropertyFilter: { schema: propertyFilterType, strategy: "input" },
  TextPropertyFilter: { schema: textPropertyFilterType, strategy: "input" },
  NumberPropertyFilter: { schema: numberPropertyFilterType, strategy: "input" },
  BooleanPropertyFilter: { schema: booleanPropertyFilterType, strategy: "input" },
  DatePropertyFilter: { schema: datePropertyFilterType, strategy: "input" },
  ComparisonOperator: { schema: comparisonOperatorType, strategy: "input" },
  SearchPropertyValue: { schema: propertyValueType, strategy: "output" },
  PublishedSearchResult: { schema: publishedSearchResultItemType, strategy: "output" },
  SearchResult: { schema: searchResultItemType, strategy: "output" },
  SearchResults: { schema: searchResultType, strategy: "output" }
} satisfies NonNullable<OpenAPIGeneratorGenerateOptions["commonSchemas"]>;

export { publicSchemas };
