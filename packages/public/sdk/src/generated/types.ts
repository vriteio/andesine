// Generated from openapi.json. Do not edit.
import type { OperationInput, OperationOutput, OperationError } from "../operation";

export type {
  Answer,
  AnswerEvent,
  AnswerHistoryMessage,
  AnswerSource,
  Asset,
  AssetAnalysis,
  AssetAnalysisStatus,
  AssetConflictErrorData,
  AssetFile,
  AssetFileFormat,
  AssetSearchResult,
  AssetStatus,
  AssetStorageErrorData,
  AssetUploadRegistration,
  AssetValidationErrorData,
  AssetVariant,
  BaseRole,
  BooleanPropertyFilter,
  ChannelContent,
  ChannelContentCollection,
  ChannelContentEntry,
  ChannelContentStatus,
  Collection,
  CollectionSchema,
  ComparisonOperator,
  ContentMark,
  ContentMarkInput,
  ContentNameConflictErrorData,
  ContentNode,
  ContentNodeInput,
  ContentSchemaInvalidErrorData,
  ContentSchemaIssue,
  ContentSchemaMetadata,
  ContentSchemaMismatchErrorData,
  DatePropertyFilter,
  EffectiveCollectionSchema,
  Entry,
  EntryFragment,
  EntryProperty,
  EntryPropertyKind,
  EntryPropertyValue,
  EntryPublication,
  EntryPublicationChannel,
  EntrySummary,
  EntryVersion,
  EntryVersionSummary,
  ErrorData,
  ForbiddenErrorData,
  InstanceInfo,
  Invite,
  InviteDeliveryResult,
  InvitePendingErrorData,
  InviteStatus,
  LocalCollectionSchema,
  Membership,
  MembershipExistsErrorData,
  MembershipInviteResult,
  NumberPropertyFilter,
  Pagination,
  Permission,
  PropertyFilter,
  PublishEntryTarget,
  PublishedAnswer,
  PublishedAnswerEvent,
  PublishedAnswerSource,
  PublishedAsset,
  PublishedCollection,
  PublishedCollectionSummary,
  PublishedContent,
  PublishedEntriesResult,
  PublishedEntry,
  PublishedEntryContent,
  PublishedEntrySummary,
  PublishedSearchResult,
  PublishedTree,
  PublishedVersion,
  PublishingChannel,
  PublishingChannelCode,
  PublishingChannelListItem,
  PublishingSnapshotErrorData,
  RateLimitErrorData,
  ResolvedSchemaDefinition,
  ResolvedSchemaField,
  RevertPublishingChangesResult,
  Role,
  SchemaApplicationResult,
  SchemaBlockType,
  SchemaDefinition,
  SchemaDraftDefinition,
  SchemaField,
  SchemaFieldKeyConflictErrorData,
  SchemaFieldSource,
  SchemaFragment,
  SchemaMigration,
  SchemaMigrationContentLossEntry,
  SchemaMigrationErrorData,
  SchemaMigrationStatus,
  SchemaProperty,
  SchemaPropertyValue,
  SchemaRevision,
  SchemaVersion,
  SchemaVersionSummary,
  SearchPropertyValue,
  SearchResult,
  SearchResults,
  TextPropertyFilter,
  UnpublishedEntriesResult,
  UserProfile,
  ValidationErrorData,
  ValidationIssue,
  VersionReason
} from "./schema";

export type AssetsAttachError = OperationError<"assets.attach">;
export type AssetsAttachInput = OperationInput<"assets.attach">;
export type AssetsAttachOutput = OperationOutput<"assets.attach">;
export type AssetsGetError = OperationError<"assets.get">;
export type AssetsGetInput = OperationInput<"assets.get">;
export type AssetsGetOutput = OperationOutput<"assets.get">;
export type AssetsImportURLError = OperationError<"assets.importURL">;
export type AssetsImportURLInput = OperationInput<"assets.importURL">;
export type AssetsImportURLOutput = OperationOutput<"assets.importURL">;
export type AssetsRegisterError = OperationError<"assets.register">;
export type AssetsRegisterInput = OperationInput<"assets.register">;
export type AssetsRegisterOutput = OperationOutput<"assets.register">;
export type AssetsSearchError = OperationError<"assets.search">;
export type AssetsSearchInput = OperationInput<"assets.search">;
export type AssetsSearchOutput = OperationOutput<"assets.search">;
export type AssetsUploadError = OperationError<"assets.upload">;
export type AssetsUploadInput = OperationInput<"assets.upload">;
export type AssetsUploadOutput = OperationOutput<"assets.upload">;
export type CollectionsBulkDeleteError = OperationError<"collections.bulkDelete">;
export type CollectionsBulkDeleteInput = OperationInput<"collections.bulkDelete">;
export type CollectionsBulkDeleteOutput = OperationOutput<"collections.bulkDelete">;
export type CollectionsCreateError = OperationError<"collections.create">;
export type CollectionsCreateInput = OperationInput<"collections.create">;
export type CollectionsCreateOutput = OperationOutput<"collections.create">;
export type CollectionsDeleteError = OperationError<"collections.delete">;
export type CollectionsDeleteInput = OperationInput<"collections.delete">;
export type CollectionsDeleteOutput = OperationOutput<"collections.delete">;
export type CollectionsListError = OperationError<"collections.list">;
export type CollectionsListInput = OperationInput<"collections.list">;
export type CollectionsListOutput = OperationOutput<"collections.list">;
export type CollectionsUpdateError = OperationError<"collections.update">;
export type CollectionsUpdateInput = OperationInput<"collections.update">;
export type CollectionsUpdateOutput = OperationOutput<"collections.update">;
export type ContentGetAssetError = OperationError<"content.getAsset">;
export type ContentGetAssetInput = OperationInput<"content.getAsset">;
export type ContentGetAssetOutput = OperationOutput<"content.getAsset">;
export type ContentGetError = OperationError<"content.get">;
export type ContentGetInput = OperationInput<"content.get">;
export type ContentGetOutput = OperationOutput<"content.get">;
export type ContentGetSchemaError = OperationError<"content.getSchema">;
export type ContentGetSchemaInput = OperationInput<"content.getSchema">;
export type ContentGetSchemaOutput = OperationOutput<"content.getSchema">;
export type ContentGetTreeError = OperationError<"content.getTree">;
export type ContentGetTreeInput = OperationInput<"content.getTree">;
export type ContentGetTreeOutput = OperationOutput<"content.getTree">;
export type ContentListCollectionsError = OperationError<"content.listCollections">;
export type ContentListCollectionsInput = OperationInput<"content.listCollections">;
export type ContentListCollectionsOutput = OperationOutput<"content.listCollections">;
export type ContentListEntriesError = OperationError<"content.listEntries">;
export type ContentListEntriesInput = OperationInput<"content.listEntries">;
export type ContentListEntriesOutput = OperationOutput<"content.listEntries">;
export type EntriesBulkDeleteError = OperationError<"entries.bulkDelete">;
export type EntriesBulkDeleteInput = OperationInput<"entries.bulkDelete">;
export type EntriesBulkDeleteOutput = OperationOutput<"entries.bulkDelete">;
export type EntriesCreateError = OperationError<"entries.create">;
export type EntriesCreateInput = OperationInput<"entries.create">;
export type EntriesCreateOutput = OperationOutput<"entries.create">;
export type EntriesDeleteError = OperationError<"entries.delete">;
export type EntriesDeleteInput = OperationInput<"entries.delete">;
export type EntriesDeleteOutput = OperationOutput<"entries.delete">;
export type EntriesGetError = OperationError<"entries.get">;
export type EntriesGetInput = OperationInput<"entries.get">;
export type EntriesGetOutput = OperationOutput<"entries.get">;
export type EntriesListError = OperationError<"entries.list">;
export type EntriesListInput = OperationInput<"entries.list">;
export type EntriesListOutput = OperationOutput<"entries.list">;
export type EntriesUpdateError = OperationError<"entries.update">;
export type EntriesUpdateInput = OperationInput<"entries.update">;
export type EntriesUpdateOutput = OperationOutput<"entries.update">;
export type InstanceGetError = OperationError<"instance.get">;
export type InstanceGetInput = OperationInput<"instance.get">;
export type InstanceGetOutput = OperationOutput<"instance.get">;
export type MembershipsInviteError = OperationError<"memberships.invite">;
export type MembershipsInviteInput = OperationInput<"memberships.invite">;
export type MembershipsInviteOutput = OperationOutput<"memberships.invite">;
export type MembershipsListError = OperationError<"memberships.list">;
export type MembershipsListInput = OperationInput<"memberships.list">;
export type MembershipsListInvitesError = OperationError<"memberships.listInvites">;
export type MembershipsListInvitesInput = OperationInput<"memberships.listInvites">;
export type MembershipsListInvitesOutput = OperationOutput<"memberships.listInvites">;
export type MembershipsListOutput = OperationOutput<"memberships.list">;
export type MembershipsRemoveError = OperationError<"memberships.remove">;
export type MembershipsRemoveInput = OperationInput<"memberships.remove">;
export type MembershipsRemoveOutput = OperationOutput<"memberships.remove">;
export type MembershipsResendInviteError = OperationError<"memberships.resendInvite">;
export type MembershipsResendInviteInput = OperationInput<"memberships.resendInvite">;
export type MembershipsResendInviteOutput = OperationOutput<"memberships.resendInvite">;
export type MembershipsRevokeInviteError = OperationError<"memberships.revokeInvite">;
export type MembershipsRevokeInviteInput = OperationInput<"memberships.revokeInvite">;
export type MembershipsRevokeInviteOutput = OperationOutput<"memberships.revokeInvite">;
export type MembershipsUpdateError = OperationError<"memberships.update">;
export type MembershipsUpdateInput = OperationInput<"memberships.update">;
export type MembershipsUpdateOutput = OperationOutput<"memberships.update">;
export type PublishingBulkPublishCollectionsError =
  OperationError<"publishing.bulkPublishCollections">;
export type PublishingBulkPublishCollectionsInput =
  OperationInput<"publishing.bulkPublishCollections">;
export type PublishingBulkPublishCollectionsOutput =
  OperationOutput<"publishing.bulkPublishCollections">;
export type PublishingBulkPublishEntriesError = OperationError<"publishing.bulkPublishEntries">;
export type PublishingBulkPublishEntriesInput = OperationInput<"publishing.bulkPublishEntries">;
export type PublishingBulkPublishEntriesOutput = OperationOutput<"publishing.bulkPublishEntries">;
export type PublishingBulkSetCollectionsError = OperationError<"publishing.bulkSetCollections">;
export type PublishingBulkSetCollectionsInput = OperationInput<"publishing.bulkSetCollections">;
export type PublishingBulkSetCollectionsOutput = OperationOutput<"publishing.bulkSetCollections">;
export type PublishingBulkUnpublishCollectionsError =
  OperationError<"publishing.bulkUnpublishCollections">;
export type PublishingBulkUnpublishCollectionsInput =
  OperationInput<"publishing.bulkUnpublishCollections">;
export type PublishingBulkUnpublishCollectionsOutput =
  OperationOutput<"publishing.bulkUnpublishCollections">;
export type PublishingBulkUnpublishEntriesError = OperationError<"publishing.bulkUnpublishEntries">;
export type PublishingBulkUnpublishEntriesInput = OperationInput<"publishing.bulkUnpublishEntries">;
export type PublishingBulkUnpublishEntriesOutput =
  OperationOutput<"publishing.bulkUnpublishEntries">;
export type PublishingCreateChannelError = OperationError<"publishing.createChannel">;
export type PublishingCreateChannelInput = OperationInput<"publishing.createChannel">;
export type PublishingCreateChannelOutput = OperationOutput<"publishing.createChannel">;
export type PublishingDeleteChannelError = OperationError<"publishing.deleteChannel">;
export type PublishingDeleteChannelInput = OperationInput<"publishing.deleteChannel">;
export type PublishingDeleteChannelOutput = OperationOutput<"publishing.deleteChannel">;
export type PublishingGetChannelContentError = OperationError<"publishing.getChannelContent">;
export type PublishingGetChannelContentInput = OperationInput<"publishing.getChannelContent">;
export type PublishingGetChannelContentOutput = OperationOutput<"publishing.getChannelContent">;
export type PublishingGetEntryVersionError = OperationError<"publishing.getEntryVersion">;
export type PublishingGetEntryVersionInput = OperationInput<"publishing.getEntryVersion">;
export type PublishingGetEntryVersionOutput = OperationOutput<"publishing.getEntryVersion">;
export type PublishingListChannelsError = OperationError<"publishing.listChannels">;
export type PublishingListChannelsInput = OperationInput<"publishing.listChannels">;
export type PublishingListChannelsOutput = OperationOutput<"publishing.listChannels">;
export type PublishingListEntryPublicationsError =
  OperationError<"publishing.listEntryPublications">;
export type PublishingListEntryPublicationsInput =
  OperationInput<"publishing.listEntryPublications">;
export type PublishingListEntryPublicationsOutput =
  OperationOutput<"publishing.listEntryPublications">;
export type PublishingPublishCollectionError = OperationError<"publishing.publishCollection">;
export type PublishingPublishCollectionInput = OperationInput<"publishing.publishCollection">;
export type PublishingPublishCollectionOutput = OperationOutput<"publishing.publishCollection">;
export type PublishingPublishEntryError = OperationError<"publishing.publishEntry">;
export type PublishingPublishEntryInput = OperationInput<"publishing.publishEntry">;
export type PublishingPublishEntryOutput = OperationOutput<"publishing.publishEntry">;
export type PublishingRevertChangesError = OperationError<"publishing.revertChanges">;
export type PublishingRevertChangesInput = OperationInput<"publishing.revertChanges">;
export type PublishingRevertChangesOutput = OperationOutput<"publishing.revertChanges">;
export type PublishingSetCollectionError = OperationError<"publishing.setCollection">;
export type PublishingSetCollectionInput = OperationInput<"publishing.setCollection">;
export type PublishingSetCollectionOutput = OperationOutput<"publishing.setCollection">;
export type PublishingUnpublishCollectionError = OperationError<"publishing.unpublishCollection">;
export type PublishingUnpublishCollectionInput = OperationInput<"publishing.unpublishCollection">;
export type PublishingUnpublishCollectionOutput = OperationOutput<"publishing.unpublishCollection">;
export type PublishingUnpublishEntryError = OperationError<"publishing.unpublishEntry">;
export type PublishingUnpublishEntryInput = OperationInput<"publishing.unpublishEntry">;
export type PublishingUnpublishEntryOutput = OperationOutput<"publishing.unpublishEntry">;
export type RolesCreateError = OperationError<"roles.create">;
export type RolesCreateInput = OperationInput<"roles.create">;
export type RolesCreateOutput = OperationOutput<"roles.create">;
export type RolesDeleteError = OperationError<"roles.delete">;
export type RolesDeleteInput = OperationInput<"roles.delete">;
export type RolesDeleteOutput = OperationOutput<"roles.delete">;
export type RolesListError = OperationError<"roles.list">;
export type RolesListInput = OperationInput<"roles.list">;
export type RolesListOutput = OperationOutput<"roles.list">;
export type RolesUpdateError = OperationError<"roles.update">;
export type RolesUpdateInput = OperationInput<"roles.update">;
export type RolesUpdateOutput = OperationOutput<"roles.update">;
export type SchemaMigrationsGetActiveError = OperationError<"schemaMigrations.getActive">;
export type SchemaMigrationsGetActiveInput = OperationInput<"schemaMigrations.getActive">;
export type SchemaMigrationsGetActiveOutput = OperationOutput<"schemaMigrations.getActive">;
export type SchemaMigrationsGetError = OperationError<"schemaMigrations.get">;
export type SchemaMigrationsGetInput = OperationInput<"schemaMigrations.get">;
export type SchemaMigrationsGetOutput = OperationOutput<"schemaMigrations.get">;
export type SchemaMigrationsListContentLossEntriesError =
  OperationError<"schemaMigrations.listContentLossEntries">;
export type SchemaMigrationsListContentLossEntriesInput =
  OperationInput<"schemaMigrations.listContentLossEntries">;
export type SchemaMigrationsListContentLossEntriesOutput =
  OperationOutput<"schemaMigrations.listContentLossEntries">;
export type SchemaVersionsGetError = OperationError<"schemaVersions.get">;
export type SchemaVersionsGetInput = OperationInput<"schemaVersions.get">;
export type SchemaVersionsGetOutput = OperationOutput<"schemaVersions.get">;
export type SchemaVersionsListError = OperationError<"schemaVersions.list">;
export type SchemaVersionsListInput = OperationInput<"schemaVersions.list">;
export type SchemaVersionsListOutput = OperationOutput<"schemaVersions.list">;
export type SchemaVersionsRevertError = OperationError<"schemaVersions.revert">;
export type SchemaVersionsRevertInput = OperationInput<"schemaVersions.revert">;
export type SchemaVersionsRevertOutput = OperationOutput<"schemaVersions.revert">;
export type SchemaVersionsUpdateError = OperationError<"schemaVersions.update">;
export type SchemaVersionsUpdateInput = OperationInput<"schemaVersions.update">;
export type SchemaVersionsUpdateOutput = OperationOutput<"schemaVersions.update">;
export type SchemasApplyError = OperationError<"schemas.apply">;
export type SchemasApplyInput = OperationInput<"schemas.apply">;
export type SchemasApplyOutput = OperationOutput<"schemas.apply">;
export type SchemasCreateError = OperationError<"schemas.create">;
export type SchemasCreateInput = OperationInput<"schemas.create">;
export type SchemasCreateOutput = OperationOutput<"schemas.create">;
export type SchemasDeleteError = OperationError<"schemas.delete">;
export type SchemasDeleteInput = OperationInput<"schemas.delete">;
export type SchemasDeleteOutput = OperationOutput<"schemas.delete">;
export type SchemasGetError = OperationError<"schemas.get">;
export type SchemasGetInput = OperationInput<"schemas.get">;
export type SchemasGetOutput = OperationOutput<"schemas.get">;
export type SchemasGetRevisionError = OperationError<"schemas.getRevision">;
export type SchemasGetRevisionInput = OperationInput<"schemas.getRevision">;
export type SchemasGetRevisionOutput = OperationOutput<"schemas.getRevision">;
export type SearchAskCurrentError = OperationError<"search.askCurrent">;
export type SearchAskCurrentInput = OperationInput<"search.askCurrent">;
export type SearchAskCurrentOutput = OperationOutput<"search.askCurrent">;
export type SearchAskCurrentStreamError = OperationError<"search.askCurrentStream">;
export type SearchAskCurrentStreamInput = OperationInput<"search.askCurrentStream">;
export type SearchAskCurrentStreamOutput = OperationOutput<"search.askCurrentStream">;
export type SearchAskPublishedError = OperationError<"search.askPublished">;
export type SearchAskPublishedInput = OperationInput<"search.askPublished">;
export type SearchAskPublishedOutput = OperationOutput<"search.askPublished">;
export type SearchAskPublishedStreamError = OperationError<"search.askPublishedStream">;
export type SearchAskPublishedStreamInput = OperationInput<"search.askPublishedStream">;
export type SearchAskPublishedStreamOutput = OperationOutput<"search.askPublishedStream">;
export type SearchCurrentError = OperationError<"search.current">;
export type SearchCurrentInput = OperationInput<"search.current">;
export type SearchCurrentOutput = OperationOutput<"search.current">;
export type SearchPublishedError = OperationError<"search.published">;
export type SearchPublishedInput = OperationInput<"search.published">;
export type SearchPublishedOutput = OperationOutput<"search.published">;
export type VersionsCreateError = OperationError<"versions.create">;
export type VersionsCreateInput = OperationInput<"versions.create">;
export type VersionsCreateOutput = OperationOutput<"versions.create">;
export type VersionsGetError = OperationError<"versions.get">;
export type VersionsGetInput = OperationInput<"versions.get">;
export type VersionsGetOutput = OperationOutput<"versions.get">;
export type VersionsListError = OperationError<"versions.list">;
export type VersionsListInput = OperationInput<"versions.list">;
export type VersionsListOutput = OperationOutput<"versions.list">;
export type VersionsRevertError = OperationError<"versions.revert">;
export type VersionsRevertInput = OperationInput<"versions.revert">;
export type VersionsRevertOutput = OperationOutput<"versions.revert">;
export type VersionsUpdateError = OperationError<"versions.update">;
export type VersionsUpdateInput = OperationInput<"versions.update">;
export type VersionsUpdateOutput = OperationOutput<"versions.update">;
