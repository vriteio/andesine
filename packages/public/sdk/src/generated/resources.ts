/* eslint-disable max-lines */
// Generated from openapi.json. Do not edit.
import { operation, type Operation, type Requester } from "../operation";

interface APIResources {
  assets: {
    /**
     * Search assets
     *
     * Finds workspace images by text or SHA-256 checksum. Semantic search defaults to true. Returns up to 50 results.
     *
     * Required API key permissions: read:entries, read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.assets.search({
     *   "query": "mountains",
     *   "limit": 10
     * });
     */
    search: Operation<"assets.search">;
    /**
     * Import an image URL
     *
     * Downloads a remote image and starts processing it for the entry. With checkDuplicates, can return an existing image instead. Use assets.get to check processing status.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.assets.importURL({
     *   "assetID": "ast_example",
     *   "entryID": "ent_example",
     *   "url": "https://example.com/image.png",
     *   "checkDuplicates": true
     * });
     */
    importURL: Operation<"assets.importURL">;
    /**
     * Attach an asset
     *
     * Attaches a ready image to an entry. This does not insert an image node into the document.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.assets.attach({
     *   "assetID": "ast_example",
     *   "entryID": "ent_example"
     * });
     */
    attach: Operation<"assets.attach">;
    /**
     * Register an image upload
     *
     * Reserves an image upload for an entry. Supply the byte count and lowercase SHA-256 checksum of the file. Call assets.upload before expiresAt, then use assets.get to check processing status.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.assets.register({
     *   "assetID": "ast_example",
     *   "entryID": "ent_example",
     *   "filename": "image.png",
     *   "byteSize": 1024,
     *   "checksum": "0000000000000000000000000000000000000000000000000000000000000000"
     * });
     */
    register: Operation<"assets.register">;
    /**
     * Upload registered image bytes
     *
     * Uploads a file for a registered asset with multipart/form-data. The bytes must match the registered size and checksum. Processing continues after the upload; use assets.get to check status.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.assets.upload({
     *   "assetID": "ast_example",
     *   "file": new Blob([imageBytes], { type: "image/png" })
     * });
     */
    upload: Operation<"assets.upload">;
    /**
     * Get asset status and details
     *
     * Returns image metadata, processing status, and available files. Supply entryID when checking access through an entry.
     *
     * @example
     * await client.assets.get({
     *   "assetID": "ast_example",
     *   "entryID": "ent_example"
     * });
     */
    get: Operation<"assets.get">;
  };
  instance: {
    /**
     * Get instance capabilities and limits
     *
     * Returns configured features and effective limits for the authenticated workspace. These values do not grant permissions or report live service health. No discovery request is made automatically by the SDK.
     *
     * @example
     * await client.instance.get({});
     */
    get: Operation<"instance.get">;
  };
  entries: {
    /**
     * Create an entry
     *
     * Creates an entry and its initial document. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. A collection schema can set the initial content.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.entries.create({
     *   "name": "Getting started",
     *   "collectionID": "coll_example"
     * });
     */
    create: Operation<"entries.create">;
    /**
     * Delete entries
     *
     * Soft-deletes the selected entries and clears current-entry selections for affected members. An active schema migration can block this action.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.entries.bulkDelete({
     *   "ids": [
     *     "ent_example"
     *   ]
     * });
     */
    bulkDelete: Operation<"entries.bulkDelete">;
    /**
     * Delete an entry
     *
     * Soft-deletes the entry and clears current-entry selections for affected members. An active schema migration can block this action.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.entries.delete({
     *   "id": "ent_example"
     * });
     */
    delete: Operation<"entries.delete">;
    /**
     * Rename an entry
     *
     * Updates the entry name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.
     *
     * Required API key permissions: entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.entries.update({
     *   "id": "ent_example",
     *   "name": "Installation"
     * });
     */
    update: Operation<"entries.update">;
    /**
     * Get an entry
     *
     * Returns current entry details, fragments, properties, and recorded schema metadata. Validates content without changing it. expectedSchemaHash must match the recorded schema; schema-less content cannot match it. Use content.get to read published content.
     *
     * Required API key permissions: read:entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.entries.get({
     *   "id": "ent_example"
     * });
     */
    get: Operation<"entries.get">;
    /**
     * List entries
     *
     * Lists entries in the selected collection, or all accessible entries when collectionID is omitted. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100 and defaults to 50.
     *
     * Required API key permissions: read:entries. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.entries.list({
     *   "collectionID": "coll_example",
     *   "limit": 20
     * });
     */
    list: Operation<"entries.list">;
  };
  collections: {
    /**
     * Create a collection
     *
     * Creates a child collection. Without parentID, uses the workspace root. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. Restricted collections require a session with restricted_collections permission and the Pro plan; API keys cannot create them.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.collections.create({
     *   "name": "Documentation",
     *   "parentID": "coll_example"
     * });
     */
    create: Operation<"collections.create">;
    /**
     * Delete collection trees
     *
     * Soft-deletes the selected collections, their descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.collections.bulkDelete({
     *   "ids": [
     *     "coll_example"
     *   ]
     * });
     */
    bulkDelete: Operation<"collections.bulkDelete">;
    /**
     * Delete a collection tree
     *
     * Soft-deletes the collection, its descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.collections.delete({
     *   "id": "coll_example"
     * });
     */
    delete: Operation<"collections.delete">;
    /**
     * Rename a collection
     *
     * Updates the collection name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.collections.update({
     *   "id": "coll_example",
     *   "name": "Guides"
     * });
     */
    update: Operation<"collections.update">;
    /**
     * List collections
     *
     * Lists collections under the selected ancestor. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.collections.list({
     *   "collectionID": "coll_example",
     *   "limit": 20
     * });
     */
    list: Operation<"collections.list">;
  };
  content: {
    /**
     * List published collections
     *
     * Returns a flat page of collections from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Optionally select direct children using collectionID or collectionPath. Results are ordered by ID, not display order.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.content.listCollections({
     *   "channel": "published",
     *   "limit": 20
     * });
     */
    listCollections: Operation<"content.listCollections">;
    /**
     * List published entries
     *
     * Returns a flat page of entries from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Select direct children using collectionID or collectionPath, or include nested entries with descendants: true. descendants requires a collection scope. All property filters must match the assigned version. includeContent: true returns validated full content, properties, fragments, assets, and recorded schema metadata. An invalid full item fails the page. Keep the same scope and filters across pages. Results are ordered by ID, not display order.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.content.listEntries({
     *   "channel": "published",
     *   "limit": 20
     * });
     */
    listEntries: Operation<"content.listEntries">;
    /**
     * Get a published entry schema
     *
     * Returns the exact recorded effective schema, or null for schema-less content. Uses the same publication access as content.get. Pass its snapshotID for a consistent read; use channel or snapshotID, not both.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.content.getSchema({
     *   "entryID": "ent_example",
     *   "channel": "published"
     * });
     */
    getSchema: Operation<"content.getSchema">;
    /**
     * Download a published asset
     *
     * Returns binary image data from a publication snapshot. No API key is required. The asset must belong to the entry in that available snapshot. Use the asset URLs returned with published content.
     *
     * @example
     * await client.content.getAsset({
     *   "workspaceID": "ws_example",
     *   "snapshotID": "snp_example",
     *   "entryID": "ent_example",
     *   "assetID": "ast_example",
     *   "variant": "display"
     * });
     */
    getAsset: Operation<"content.getAsset">;
    /**
     * Get published entry content
     *
     * Returns content from a publishing channel or a specific available snapshot. Use channel or snapshotID, never both. The default channel is published. Validates saved content against its recorded schema and returns schema metadata. expectedSchemaHash must match that revision; schema-less content cannot match it. Validation and hash checks run before ETag handling. Supports ETag and If-None-Match; a match returns 304 without a body.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.content.get({
     *   "entryID": "ent_example",
     *   "channel": "published"
     * });
     */
    get: Operation<"content.get">;
    /**
     * Get a published collection tree
     *
     * Returns a published collection tree and its snapshot ID. Use channel or snapshotID, never both. The default channel is published. Reuse the snapshot ID for consistent content reads. Supports ETag and If-None-Match; a match returns 304 without a body.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.content.getTree({
     *   "collectionID": "coll_example",
     *   "channel": "published"
     * });
     */
    getTree: Operation<"content.getTree">;
  };
  roles: {
    /**
     * List roles
     *
     * Returns workspace roles and their permissions.
     *
     * Required API key permissions: read:roles. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.roles.list({});
     */
    list: Operation<"roles.list">;
    /**
     * Create a role
     *
     * Creates a workspace role. Names are unique without regard to case and must contain 1 to 50 characters after trimming. Requires the Pro plan and permission to delegate the selected permissions.
     *
     * Required API key permissions: roles. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.roles.create({
     *   "name": "Editor",
     *   "permissions": [
     *     "content"
     *   ]
     * });
     */
    create: Operation<"roles.create">;
    /**
     * Update a role
     *
     * Changes a role name or permissions. Names are unique without regard to case. Requires the Pro plan and permission to delegate the selected permissions. Built-in roles have additional restrictions.
     *
     * Required API key permissions: roles. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.roles.update({
     *   "id": "rl_example",
     *   "name": "Content editor"
     * });
     */
    update: Operation<"roles.update">;
    /**
     * Delete a role
     *
     * Deletes a custom role and updates its assignments. Built-in roles cannot be deleted. Requires the Pro plan.
     *
     * Required API key permissions: roles. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.roles.delete({
     *   "id": "rl_example"
     * });
     */
    delete: Operation<"roles.delete">;
  };
  search: {
    /**
     * Search current content
     *
     * Searches current entry content by text and optional property filters. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.
     *
     * Required API key permissions: read:entries, read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.search.current({
     *   "query": "installation",
     *   "limit": 10
     * });
     */
    current: Operation<"search.current">;
    /**
     * Search published content
     *
     * Searches content published to the required channel. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.search.published({
     *   "query": "installation",
     *   "channel": "published",
     *   "limit": 10
     * });
     */
    published: Operation<"search.published">;
    /**
     * Ask AI about current content
     *
     * Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.
     *
     * Required API key permissions: ai-answers, read:entries, read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.search.askCurrent({
     *   "question": "How do I install Andesine?"
     * });
     */
    askCurrent: Operation<"search.askCurrent">;
    /**
     * Ask AI about published content
     *
     * Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.
     *
     * Required API key permissions: ai-answers, read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.search.askPublished({
     *   "question": "How do I install Andesine?",
     *   "channel": "published"
     * });
     */
    askPublished: Operation<"search.askPublished">;
    /**
     * Stream an AI answer about current content
     *
     * Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically.
     *
     * Required API key permissions: ai-answers, read:entries, read:collections. Write permissions also grant read access for the same resource.
     */
    askCurrentStream: Operation<"search.askCurrentStream">;
    /**
     * Stream an AI answer about published content
     *
     * Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically.
     *
     * Required API key permissions: ai-answers, read:publishing. Write permissions also grant read access for the same resource.
     */
    askPublishedStream: Operation<"search.askPublishedStream">;
  };
  schemas: {
    /**
     * Create a local collection schema
     *
     * Creates a local schema draft for the collection. Use schemas.get to inspect local and effective schemas.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemas.create({
     *   "collectionID": "coll_example"
     * });
     */
    create: Operation<"schemas.create">;
    /**
     * Delete a local schema
     *
     * Removes the local schema and recalculates inherited schemas. This can start a content migration. Review possible content removal before setting confirmedDataLoss. Use schemaMigrations.get with a returned migrationID.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemas.delete({
     *   "schemaID": "sch_example",
     *   "confirmedDataLoss": false
     * });
     */
    delete: Operation<"schemas.delete">;
    /**
     * Get an exact schema revision
     *
     * Returns the recorded effective definition, including inherited fields. Requires read access to the revision's collection. The definition is independent of the currently active schema.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemas.getRevision({
     *   "revisionID": "schr_example"
     * });
     */
    getRevision: Operation<"schemas.getRevision">;
    /**
     * Get collection schemas
     *
     * Returns local and effective schema details for the collection, including inheritance.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemas.get({
     *   "collectionID": "coll_example"
     * });
     */
    get: Operation<"schemas.get">;
    /**
     * Apply a schema draft
     *
     * Creates a schema version from the draft and starts any required migration of affected entry content. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemas.apply({
     *   "schemaID": "sch_example",
     *   "confirmedDataLoss": true,
     *   "name": "Reviewed schema"
     * });
     */
    apply: Operation<"schemas.apply">;
  };
  schemaMigrations: {
    /**
     * List entries with migration content loss
     *
     * Lists accessible, non-deleted entries that lost content in a completed migration. Returns an empty page until completion. Use pagination.nextCursor to continue.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemaMigrations.listContentLossEntries({
     *   "id": "smg_example",
     *   "limit": 20
     * });
     */
    listContentLossEntries: Operation<"schemaMigrations.listContentLossEntries">;
    /**
     * Get the active schema migration
     *
     * Returns the active migration for a collection, or null when none is active.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemaMigrations.getActive({
     *   "collectionID": "coll_example"
     * });
     */
    getActive: Operation<"schemaMigrations.getActive">;
    /**
     * Get schema migration status
     *
     * Returns bounded migration progress and status. Use schemaMigrations.listContentLossEntries for per-entry content loss details. Check status before repeating an operation blocked by this migration.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemaMigrations.get({
     *   "id": "smg_example"
     * });
     */
    get: Operation<"schemaMigrations.get">;
  };
  schemaVersions: {
    /**
     * List schema versions
     *
     * Lists versions of a local collection schema. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemaVersions.list({
     *   "schemaID": "sch_example",
     *   "limit": 20
     * });
     */
    list: Operation<"schemaVersions.list">;
    /**
     * Get a schema version
     *
     * Returns a saved schema version and its definition.
     *
     * Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemaVersions.get({
     *   "id": "schv_example"
     * });
     */
    get: Operation<"schemaVersions.get">;
    /**
     * Rename a schema version
     *
     * Changes the saved version name. Set name to null to remove the name.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemaVersions.update({
     *   "id": "schv_example",
     *   "name": "Reviewed schema"
     * });
     */
    update: Operation<"schemaVersions.update">;
    /**
     * Restore a schema version
     *
     * Restores the selected definition and starts any required content migration. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.
     *
     * Required API key permissions: collections. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.schemaVersions.revert({
     *   "id": "schv_example",
     *   "confirmedDataLoss": true
     * });
     */
    revert: Operation<"schemaVersions.revert">;
  };
  memberships: {
    /**
     * List workspace members
     *
     * Lists workspace memberships with role and user details. Use pagination.nextCursor to continue with the same filters; concurrent changes can affect later pages.
     *
     * Required API key permissions: read:memberships. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.memberships.list({});
     */
    list: Operation<"memberships.list">;
    /**
     * Invite a workspace member
     *
     * Creates an invitation and attempts email delivery. Check emailDelivery in the result. Requires the Pro plan and permission to delegate the selected role. Existing membership or pending invitation returns a conflict.
     *
     * Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.memberships.invite({
     *   "email": "editor@example.com",
     *   "roleID": "rl_example"
     * });
     */
    invite: Operation<"memberships.invite">;
    /**
     * Change a member role
     *
     * Assigns a new role to a member. Requires the Pro plan and permission to delegate that role. Administrator assignments have additional restrictions.
     *
     * Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.memberships.update({
     *   "id": "ms_example",
     *   "roleID": "rl_example"
     * });
     */
    update: Operation<"memberships.update">;
    /**
     * Remove a workspace member
     *
     * Removes the membership and its workspace access. Administrator memberships have additional restrictions.
     *
     * Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.memberships.remove({
     *   "id": "ms_example"
     * });
     */
    remove: Operation<"memberships.remove">;
    /**
     * List invitations
     *
     * Lists pending, unexpired workspace invitations. Use pagination.nextCursor to continue. Requires the Pro plan.
     *
     * Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.memberships.listInvites({});
     */
    listInvites: Operation<"memberships.listInvites">;
    /**
     * Resend an invitation
     *
     * Attempts email delivery again for a pending invitation. Check emailDelivery in the result. Requires the Pro plan.
     *
     * Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.memberships.resendInvite({
     *   "id": "inv_example"
     * });
     */
    resendInvite: Operation<"memberships.resendInvite">;
    /**
     * Revoke an invitation
     *
     * Revokes a pending invitation so it can no longer be accepted. Requires the Pro plan.
     *
     * Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.memberships.revokeInvite({
     *   "id": "inv_example"
     * });
     */
    revokeInvite: Operation<"memberships.revokeInvite">;
  };
  publishing: {
    /**
     * Configure collection publishing
     *
     * Enables publishing for a collection, or disables it and unpublishes its tree from all channels. When enabling, publish can also publish the latest entry versions.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.setCollection({
     *   "collectionID": "coll_example",
     *   "enabled": true,
     *   "publish": false
     * });
     */
    setCollection: Operation<"publishing.setCollection">;
    /**
     * Publish a collection tree
     *
     * Publishes the latest entry versions in a publishing-enabled collection tree to the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.publishCollection({
     *   "collectionID": "coll_example",
     *   "channel": "published"
     * });
     */
    publishCollection: Operation<"publishing.publishCollection">;
    /**
     * Unpublish a collection tree
     *
     * Removes publication assignments for a collection tree from the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.unpublishCollection({
     *   "collectionID": "coll_example",
     *   "channel": "published"
     * });
     */
    unpublishCollection: Operation<"publishing.unpublishCollection">;
    /**
     * Configure publishing for collections
     *
     * Enables publishing for the selected collections, or disables it and unpublishes their trees from all channels. When enabling, publish can also publish the latest entry versions.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.bulkSetCollections({
     *   "ids": [
     *     "coll_example"
     *   ],
     *   "enabled": true,
     *   "publish": false
     * });
     */
    bulkSetCollections: Operation<"publishing.bulkSetCollections">;
    /**
     * Publish collection trees
     *
     * Publishes the latest entry versions in the selected publishing-enabled collection trees. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.bulkPublishCollections({
     *   "ids": [
     *     "coll_example"
     *   ],
     *   "channel": "published"
     * });
     */
    bulkPublishCollections: Operation<"publishing.bulkPublishCollections">;
    /**
     * Unpublish collection trees
     *
     * Removes publication assignments for the selected collection trees from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.bulkUnpublishCollections({
     *   "ids": [
     *     "coll_example"
     *   ],
     *   "channel": "published"
     * });
     */
    bulkUnpublishCollections: Operation<"publishing.bulkUnpublishCollections">;
    /**
     * Publish an entry
     *
     * Publishes an existing version, or the latest entry content if versionID is omitted. The entry must be in a publishing-enabled collection. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.publishEntry({
     *   "entryID": "ent_example",
     *   "channel": "published"
     * });
     */
    publishEntry: Operation<"publishing.publishEntry">;
    /**
     * Unpublish an entry
     *
     * Removes the entry publication from the channel. Supply versionID to require that version to be assigned; a changed assignment returns a conflict. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.unpublishEntry({
     *   "entryID": "ent_example",
     *   "channel": "published",
     *   "versionID": "ver_example"
     * });
     */
    unpublishEntry: Operation<"publishing.unpublishEntry">;
    /**
     * Publish entries
     *
     * Publishes the selected entries with optional version IDs. Entries must be in publishing-enabled collections. At least one entry is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.bulkPublishEntries({
     *   "entries": [
     *     {
     *       "entryID": "ent_example"
     *     }
     *   ],
     *   "channel": "published"
     * });
     */
    bulkPublishEntries: Operation<"publishing.bulkPublishEntries">;
    /**
     * Unpublish entries
     *
     * Removes publication assignments for the selected entries from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.bulkUnpublishEntries({
     *   "ids": [
     *     "ent_example"
     *   ],
     *   "channel": "published"
     * });
     */
    bulkUnpublishEntries: Operation<"publishing.bulkUnpublishEntries">;
    /**
     * Revert pending publishing changes
     *
     * Restores selected drafts to the reviewed publication snapshot. This can remove unpublished items and replace draft content. First review publishing.getChannelContent and pass its snapshotID. Use all: true or specific collectionIDs/entryIDs, never both. Requires write access to affected resources in addition to read:publishing.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.revertChanges({
     *   "collectionID": "coll_example",
     *   "snapshotID": "snp_example",
     *   "entryIDs": [
     *     "ent_example"
     *   ],
     *   "channel": "published"
     * });
     */
    revertChanges: Operation<"publishing.revertChanges">;
    /**
     * Get a published entry version
     *
     * Returns the entry version assigned to a channel, or to an explicit available snapshot, with its recorded schema metadata. Validates content against that revision. expectedSchemaHash must match it; schema-less content cannot match it. The default channel is published.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.getEntryVersion({
     *   "entryID": "ent_example",
     *   "channel": "published"
     * });
     */
    getEntryVersion: Operation<"publishing.getEntryVersion">;
    /**
     * List entry publications
     *
     * Returns the entry publication assignments across channels.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.listEntryPublications({
     *   "entryID": "ent_example"
     * });
     */
    listEntryPublications: Operation<"publishing.listEntryPublications">;
    /**
     * List publishing channels
     *
     * Returns workspace publishing channels. Set includeAssignmentCount to include entry assignment counts.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.listChannels({
     *   "includeAssignmentCount": true
     * });
     */
    listChannels: Operation<"publishing.listChannels">;
    /**
     * Create a publishing channel
     *
     * Creates a publishing channel from its display name and returns the generated channel code.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.createChannel({
     *   "name": "Preview"
     * });
     */
    createChannel: Operation<"publishing.createChannel">;
    /**
     * Get channel content and pending changes
     *
     * Returns publication state and pending changes for a publishing root, with the snapshot ID needed to review and revert changes.
     *
     * Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.getChannelContent({
     *   "channel": "published",
     *   "collectionID": "coll_example"
     * });
     */
    getChannelContent: Operation<"publishing.getChannelContent">;
    /**
     * Delete a publishing channel
     *
     * Deletes a custom channel and its publication assignments. The default published channel cannot be deleted.
     *
     * Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.publishing.deleteChannel({
     *   "code": "preview"
     * });
     */
    deleteChannel: Operation<"publishing.deleteChannel">;
  };
  versions: {
    /**
     * Create an entry version
     *
     * Saves a version of the current entry content. Optionally assigns a name.
     *
     * Required API key permissions: versions. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.versions.create({
     *   "entryID": "ent_example",
     *   "name": "Before release"
     * });
     */
    create: Operation<"versions.create">;
    /**
     * List entry versions
     *
     * Lists saved entry versions. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.
     *
     * Required API key permissions: read:versions. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.versions.list({
     *   "entryID": "ent_example",
     *   "limit": 20
     * });
     */
    list: Operation<"versions.list">;
    /**
     * Get an entry version
     *
     * Returns the saved content and recorded schema metadata of an entry version. Validates against its recorded revision, including historical versions. expectedSchemaHash must match that revision; schema-less content cannot match it.
     *
     * Required API key permissions: read:versions. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.versions.get({
     *   "id": "ver_example"
     * });
     */
    get: Operation<"versions.get">;
    /**
     * Rename an entry version
     *
     * Changes the saved version name. Set name to null to remove the name.
     *
     * Required API key permissions: versions. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.versions.update({
     *   "id": "ver_example",
     *   "name": "Release candidate"
     * });
     */
    update: Operation<"versions.update">;
    /**
     * Restore an entry version
     *
     * Restores saved content to the current entry and returns the resulting version. An active schema migration can block this action.
     *
     * Required API key permissions: versions. Write permissions also grant read access for the same resource.
     *
     * @example
     * await client.versions.revert({
     *   "id": "ver_example"
     * });
     */
    revert: Operation<"versions.revert">;
  };
}

const createResources = (request: Requester): APIResources => ({
  assets: {
    search: operation<"assets.search">(request, {
      method: "get",
      path: "/assets/search",
      pathParams: [],
      queryParams: ["query", "checksum", "semantic", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    importURL: operation<"assets.importURL">(request, {
      method: "post",
      path: "/assets/imports",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    attach: operation<"assets.attach">(request, {
      method: "post",
      path: "/assets/{assetID}/attachments",
      pathParams: ["assetID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    register: operation<"assets.register">(request, {
      method: "post",
      path: "/assets/uploads",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    upload: operation<"assets.upload">(request, {
      method: "put",
      path: "/assets/{assetID}/upload",
      pathParams: ["assetID"],
      queryParams: [],
      body: true,
      multipart: true,
      binary: false,
      anonymous: false
    }),
    get: operation<"assets.get">(request, {
      method: "get",
      path: "/assets/{assetID}",
      pathParams: ["assetID"],
      queryParams: ["entryID"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  instance: {
    get: operation<"instance.get">(request, {
      method: "get",
      path: "/instance",
      pathParams: [],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  entries: {
    create: operation<"entries.create">(request, {
      method: "post",
      path: "/entries",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    bulkDelete: operation<"entries.bulkDelete">(request, {
      method: "post",
      path: "/entries/bulk/delete",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    delete: operation<"entries.delete">(request, {
      method: "delete",
      path: "/entries/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    update: operation<"entries.update">(request, {
      method: "put",
      path: "/entries/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    get: operation<"entries.get">(request, {
      method: "get",
      path: "/entries/get",
      pathParams: [],
      queryParams: ["id", "path", "expectedSchemaHash"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    list: operation<"entries.list">(request, {
      method: "get",
      path: "/entries/list",
      pathParams: [],
      queryParams: ["collectionID", "collectionPath", "cursor", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  collections: {
    create: operation<"collections.create">(request, {
      method: "post",
      path: "/collections",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    bulkDelete: operation<"collections.bulkDelete">(request, {
      method: "post",
      path: "/collections/bulk/delete",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    delete: operation<"collections.delete">(request, {
      method: "delete",
      path: "/collections/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    update: operation<"collections.update">(request, {
      method: "put",
      path: "/collections/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    list: operation<"collections.list">(request, {
      method: "get",
      path: "/collections/list",
      pathParams: [],
      queryParams: ["collectionID", "collectionPath", "cursor", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  content: {
    listCollections: operation<"content.listCollections">(request, {
      method: "get",
      path: "/content/collections",
      pathParams: [],
      queryParams: ["cursor", "limit", "collectionID", "collectionPath", "channel", "snapshotID"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    listEntries: operation<"content.listEntries">(request, {
      method: "get",
      path: "/content/entries",
      pathParams: [],
      queryParams: [
        "cursor",
        "limit",
        "collectionID",
        "collectionPath",
        "channel",
        "snapshotID",
        "descendants",
        "includeContent",
        "filters"
      ],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    getSchema: operation<"content.getSchema">(request, {
      method: "get",
      path: "/content/entries/schema",
      pathParams: [],
      queryParams: ["entryID", "path", "channel", "snapshotID"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    getAsset: operation<"content.getAsset">(request, {
      method: "get",
      path: "/content/assets/{workspaceID}/{snapshotID}/{entryID}/{assetID}/{variant}",
      pathParams: ["workspaceID", "snapshotID", "entryID", "assetID", "variant"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: true,
      anonymous: true
    }),
    get: operation<"content.get">(request, {
      method: "get",
      path: "/content/entries/get",
      pathParams: [],
      queryParams: ["entryID", "path", "expectedSchemaHash", "channel", "snapshotID"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    getTree: operation<"content.getTree">(request, {
      method: "get",
      path: "/content/tree",
      pathParams: [],
      queryParams: ["collectionID", "collectionPath", "channel", "snapshotID"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  roles: {
    list: operation<"roles.list">(request, {
      method: "get",
      path: "/roles",
      pathParams: [],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    create: operation<"roles.create">(request, {
      method: "post",
      path: "/roles",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    update: operation<"roles.update">(request, {
      method: "put",
      path: "/roles/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    delete: operation<"roles.delete">(request, {
      method: "delete",
      path: "/roles/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  search: {
    current: operation<"search.current">(request, {
      method: "post",
      path: "/search/current",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    published: operation<"search.published">(request, {
      method: "post",
      path: "/search/published",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    askCurrent: operation<"search.askCurrent">(request, {
      method: "post",
      path: "/search/current/ask",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    askPublished: operation<"search.askPublished">(request, {
      method: "post",
      path: "/search/published/ask",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    askCurrentStream: operation<"search.askCurrentStream">(request, {
      streaming: true,
      method: "post",
      path: "/search/current/ask/stream",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    askPublishedStream: operation<"search.askPublishedStream">(request, {
      streaming: true,
      method: "post",
      path: "/search/published/ask/stream",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  schemas: {
    create: operation<"schemas.create">(request, {
      method: "post",
      path: "/collections/{collectionID}/schema",
      pathParams: ["collectionID"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    delete: operation<"schemas.delete">(request, {
      method: "delete",
      path: "/schemas/{schemaID}",
      pathParams: ["schemaID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    getRevision: operation<"schemas.getRevision">(request, {
      method: "get",
      path: "/schema-revisions/{revisionID}",
      pathParams: ["revisionID"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    get: operation<"schemas.get">(request, {
      method: "get",
      path: "/schemas/collection",
      pathParams: [],
      queryParams: ["collectionID", "collectionPath"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    apply: operation<"schemas.apply">(request, {
      method: "post",
      path: "/schemas/{schemaID}/apply",
      pathParams: ["schemaID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  schemaMigrations: {
    listContentLossEntries: operation<"schemaMigrations.listContentLossEntries">(request, {
      method: "get",
      path: "/schema-migrations/{id}/content-loss-entries",
      pathParams: ["id"],
      queryParams: ["cursor", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    getActive: operation<"schemaMigrations.getActive">(request, {
      method: "get",
      path: "/collections/{collectionID}/schema-migration",
      pathParams: ["collectionID"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    get: operation<"schemaMigrations.get">(request, {
      method: "get",
      path: "/schema-migrations/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  schemaVersions: {
    list: operation<"schemaVersions.list">(request, {
      method: "get",
      path: "/schemas/{schemaID}/versions",
      pathParams: ["schemaID"],
      queryParams: ["cursor", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    get: operation<"schemaVersions.get">(request, {
      method: "get",
      path: "/schema-versions/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    update: operation<"schemaVersions.update">(request, {
      method: "patch",
      path: "/schema-versions/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    revert: operation<"schemaVersions.revert">(request, {
      method: "post",
      path: "/schema-versions/{id}/revert",
      pathParams: ["id"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  memberships: {
    list: operation<"memberships.list">(request, {
      method: "get",
      path: "/memberships",
      pathParams: [],
      queryParams: ["cursor", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    invite: operation<"memberships.invite">(request, {
      method: "post",
      path: "/memberships",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    update: operation<"memberships.update">(request, {
      method: "patch",
      path: "/memberships/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    remove: operation<"memberships.remove">(request, {
      method: "delete",
      path: "/memberships/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    listInvites: operation<"memberships.listInvites">(request, {
      method: "get",
      path: "/memberships/invites",
      pathParams: [],
      queryParams: ["cursor", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    resendInvite: operation<"memberships.resendInvite">(request, {
      method: "post",
      path: "/memberships/invites/{id}/resend",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    revokeInvite: operation<"memberships.revokeInvite">(request, {
      method: "delete",
      path: "/memberships/invites/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  publishing: {
    setCollection: operation<"publishing.setCollection">(request, {
      method: "put",
      path: "/publishing/collections/{collectionID}",
      pathParams: ["collectionID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    publishCollection: operation<"publishing.publishCollection">(request, {
      method: "post",
      path: "/publishing/collections/{collectionID}",
      pathParams: ["collectionID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    unpublishCollection: operation<"publishing.unpublishCollection">(request, {
      method: "delete",
      path: "/publishing/collections/{collectionID}",
      pathParams: ["collectionID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    bulkSetCollections: operation<"publishing.bulkSetCollections">(request, {
      method: "post",
      path: "/publishing/collections/bulk/set",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    bulkPublishCollections: operation<"publishing.bulkPublishCollections">(request, {
      method: "post",
      path: "/publishing/collections/bulk/publish",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    bulkUnpublishCollections: operation<"publishing.bulkUnpublishCollections">(request, {
      method: "post",
      path: "/publishing/collections/bulk/unpublish",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    publishEntry: operation<"publishing.publishEntry">(request, {
      method: "post",
      path: "/publishing/entries/{entryID}",
      pathParams: ["entryID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    unpublishEntry: operation<"publishing.unpublishEntry">(request, {
      method: "delete",
      path: "/publishing/entries/{entryID}",
      pathParams: ["entryID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    bulkPublishEntries: operation<"publishing.bulkPublishEntries">(request, {
      method: "post",
      path: "/publishing/entries/bulk/publish",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    bulkUnpublishEntries: operation<"publishing.bulkUnpublishEntries">(request, {
      method: "post",
      path: "/publishing/entries/bulk/unpublish",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    revertChanges: operation<"publishing.revertChanges">(request, {
      method: "post",
      path: "/publishing/changes/revert",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    getEntryVersion: operation<"publishing.getEntryVersion">(request, {
      method: "get",
      path: "/publishing/entries/{entryID}/version",
      pathParams: ["entryID"],
      queryParams: ["channel", "expectedSchemaHash", "snapshotID"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    listEntryPublications: operation<"publishing.listEntryPublications">(request, {
      method: "get",
      path: "/publishing/entries/{entryID}/publications",
      pathParams: ["entryID"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    listChannels: operation<"publishing.listChannels">(request, {
      method: "get",
      path: "/publishing/channels",
      pathParams: [],
      queryParams: ["includeAssignmentCount"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    createChannel: operation<"publishing.createChannel">(request, {
      method: "post",
      path: "/publishing/channels",
      pathParams: [],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    getChannelContent: operation<"publishing.getChannelContent">(request, {
      method: "get",
      path: "/publishing/channels/{channel}/content",
      pathParams: ["channel"],
      queryParams: ["collectionID"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    deleteChannel: operation<"publishing.deleteChannel">(request, {
      method: "delete",
      path: "/publishing/channels/{code}",
      pathParams: ["code"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    })
  },
  versions: {
    create: operation<"versions.create">(request, {
      method: "post",
      path: "/entries/{entryID}/versions",
      pathParams: ["entryID"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    list: operation<"versions.list">(request, {
      method: "get",
      path: "/entries/{entryID}/versions",
      pathParams: ["entryID"],
      queryParams: ["cursor", "limit"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    get: operation<"versions.get">(request, {
      method: "get",
      path: "/versions/{id}",
      pathParams: ["id"],
      queryParams: ["expectedSchemaHash"],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    update: operation<"versions.update">(request, {
      method: "patch",
      path: "/versions/{id}",
      pathParams: ["id"],
      queryParams: [],
      body: true,
      multipart: false,
      binary: false,
      anonymous: false
    }),
    revert: operation<"versions.revert">(request, {
      method: "post",
      path: "/versions/{id}/revert",
      pathParams: ["id"],
      queryParams: [],
      body: false,
      multipart: false,
      binary: false,
      anonymous: false
    })
  }
});

export { createResources };
export type { APIResources };
