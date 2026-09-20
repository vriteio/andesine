/* eslint-disable max-lines */
// Generated from openapi.json. Do not edit.
export interface paths {
  "/assets/search": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Search assets
     * @description Finds workspace images by text or SHA-256 checksum. Semantic search defaults to true. Returns up to 50 results.
     *
     *     Required API key permissions: read:entries, read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["assets.search"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/assets/imports": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Import an image URL
     * @description Downloads a remote image and starts processing it for the entry. With checkDuplicates, can return an existing image instead. Use assets.get to check processing status.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    post: operations["assets.importURL"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/assets/{assetID}/attachments": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Attach an asset
     * @description Attaches a ready image to an entry. This does not insert an image node into the document.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    post: operations["assets.attach"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/assets/uploads": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Register an image upload
     * @description Reserves an image upload for an entry. Supply the byte count and lowercase SHA-256 checksum of the file. Call assets.upload before expiresAt, then use assets.get to check processing status.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    post: operations["assets.register"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/assets/{assetID}/upload": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /**
     * Upload registered image bytes
     * @description Uploads a file for a registered asset with multipart/form-data. The bytes must match the registered size and checksum. Processing continues after the upload; use assets.get to check status.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    put: operations["assets.upload"];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/assets/{assetID}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get asset status and details
     * @description Returns image metadata, processing status, and available files. Supply entryID when checking access through an entry.
     */
    get: operations["assets.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/instance": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get instance capabilities and limits
     * @description Returns configured features and effective limits for the authenticated workspace. These values do not grant permissions or report live service health. No discovery request is made automatically by the SDK.
     */
    get: operations["instance.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/entries": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Create an entry
     * @description Creates an entry and its initial document. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. A collection schema can set the initial content.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    post: operations["entries.create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/entries/bulk/delete": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Delete entries
     * @description Soft-deletes the selected entries and clears current-entry selections for affected members. An active schema migration can block this action.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    post: operations["entries.bulkDelete"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/entries/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /**
     * Rename an entry
     * @description Updates the entry name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    put: operations["entries.update"];
    post?: never;
    /**
     * Delete an entry
     * @description Soft-deletes the entry and clears current-entry selections for affected members. An active schema migration can block this action.
     *
     *     Required API key permissions: entries. Write permissions also grant read access for the same resource.
     */
    delete: operations["entries.delete"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/entries/get": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get an entry
     * @description Returns current entry details, fragments, properties, and recorded schema metadata. Validates content without changing it. expectedSchemaHash must match the recorded schema; schema-less content cannot match it. Use content.get to read published content.
     *
     *     Required API key permissions: read:entries. Write permissions also grant read access for the same resource.
     */
    get: operations["entries.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/entries/list": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List entries
     * @description Lists entries in the selected collection, or all accessible entries when collectionID is omitted. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100 and defaults to 50.
     *
     *     Required API key permissions: read:entries. Write permissions also grant read access for the same resource.
     */
    get: operations["entries.list"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/collections": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Create a collection
     * @description Creates a child collection. Without parentID, uses the workspace root. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. Restricted collections require a session with restricted_collections permission and the Pro plan; API keys cannot create them.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    post: operations["collections.create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/collections/bulk/delete": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Delete collection trees
     * @description Soft-deletes the selected collections, their descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    post: operations["collections.bulkDelete"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/collections/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /**
     * Rename a collection
     * @description Updates the collection name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    put: operations["collections.update"];
    post?: never;
    /**
     * Delete a collection tree
     * @description Soft-deletes the collection, its descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    delete: operations["collections.delete"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/collections/list": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List collections
     * @description Lists collections under the selected ancestor. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["collections.list"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/content/collections": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List published collections
     * @description Returns a flat page of collections from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Optionally select direct children using collectionID or collectionPath. Results are ordered by ID, not display order.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["content.listCollections"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/content/entries": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List published entries
     * @description Returns a flat page of entries from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Select direct children using collectionID or collectionPath, or include nested entries with descendants: true. descendants requires a collection scope. All property filters must match the assigned version. includeContent: true returns validated full content, properties, fragments, assets, and recorded schema metadata. An invalid full item fails the page. Keep the same scope and filters across pages. Results are ordered by ID, not display order.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["content.listEntries"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/content/entries/schema": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get a published entry schema
     * @description Returns the exact recorded effective schema, or null for schema-less content. Uses the same publication access as content.get. Pass its snapshotID for a consistent read; use channel or snapshotID, not both.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["content.getSchema"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/content/assets/{workspaceID}/{snapshotID}/{entryID}/{assetID}/{variant}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Download a published asset
     * @description Returns binary image data from a publication snapshot. No API key is required. The asset must belong to the entry in that available snapshot. Use the asset URLs returned with published content.
     */
    get: operations["content.getAsset"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/content/entries/get": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get published entry content
     * @description Returns content from a publishing channel or a specific available snapshot. Use channel or snapshotID, never both. The default channel is published. Validates saved content against its recorded schema and returns schema metadata. expectedSchemaHash must match that revision; schema-less content cannot match it. Validation and hash checks run before ETag handling. Supports ETag and If-None-Match; a match returns 304 without a body.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["content.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/content/tree": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get a published collection tree
     * @description Returns a published collection tree and its snapshot ID. Use channel or snapshotID, never both. The default channel is published. Reuse the snapshot ID for consistent content reads. Supports ETag and If-None-Match; a match returns 304 without a body.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["content.getTree"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/roles": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List roles
     * @description Returns workspace roles and their permissions.
     *
     *     Required API key permissions: read:roles. Write permissions also grant read access for the same resource.
     */
    get: operations["roles.list"];
    put?: never;
    /**
     * Create a role
     * @description Creates a workspace role. Names are unique without regard to case and must contain 1 to 50 characters after trimming. Requires the Pro plan and permission to delegate the selected permissions.
     *
     *     Required API key permissions: roles. Write permissions also grant read access for the same resource.
     */
    post: operations["roles.create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/roles/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /**
     * Update a role
     * @description Changes a role name or permissions. Names are unique without regard to case. Requires the Pro plan and permission to delegate the selected permissions. Built-in roles have additional restrictions.
     *
     *     Required API key permissions: roles. Write permissions also grant read access for the same resource.
     */
    put: operations["roles.update"];
    post?: never;
    /**
     * Delete a role
     * @description Deletes a custom role and updates its assignments. Built-in roles cannot be deleted. Requires the Pro plan.
     *
     *     Required API key permissions: roles. Write permissions also grant read access for the same resource.
     */
    delete: operations["roles.delete"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/search/current": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Search current content
     * @description Searches current entry content by text and optional property filters. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.
     *
     *     Required API key permissions: read:entries, read:collections. Write permissions also grant read access for the same resource.
     */
    post: operations["search.current"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/search/published": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Search published content
     * @description Searches content published to the required channel. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["search.published"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/search/current/ask": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Ask AI about current content
     * @description Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.
     *
     *     Required API key permissions: ai-answers, read:entries, read:collections. Write permissions also grant read access for the same resource.
     */
    post: operations["search.askCurrent"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/search/published/ask": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Ask AI about published content
     * @description Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.
     *
     *     Required API key permissions: ai-answers, read:publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["search.askPublished"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/search/current/ask/stream": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Stream an AI answer about current content
     * @description Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically.
     *
     *     Required API key permissions: ai-answers, read:entries, read:collections. Write permissions also grant read access for the same resource.
     */
    post: operations["search.askCurrentStream"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/search/published/ask/stream": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Stream an AI answer about published content
     * @description Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically.
     *
     *     Required API key permissions: ai-answers, read:publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["search.askPublishedStream"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/collections/{collectionID}/schema": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Create a local collection schema
     * @description Creates a local schema draft for the collection. Use schemas.get to inspect local and effective schemas.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    post: operations["schemas.create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schemas/{schemaID}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Delete a local schema
     * @description Removes the local schema and recalculates inherited schemas. This can start a content migration. Review possible content removal before setting confirmedDataLoss. Use schemaMigrations.get with a returned migrationID.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    delete: operations["schemas.delete"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schema-revisions/{revisionID}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get an exact schema revision
     * @description Returns the recorded effective definition, including inherited fields. Requires read access to the revision's collection. The definition is independent of the currently active schema.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["schemas.getRevision"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schemas/collection": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get collection schemas
     * @description Returns local and effective schema details for the collection, including inheritance.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["schemas.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schemas/{schemaID}/apply": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Apply a schema draft
     * @description Creates a schema version from the draft and starts any required migration of affected entry content. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    post: operations["schemas.apply"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schema-migrations/{id}/content-loss-entries": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List entries with migration content loss
     * @description Lists accessible, non-deleted entries that lost content in a completed migration. Returns an empty page until completion. Use pagination.nextCursor to continue.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["schemaMigrations.listContentLossEntries"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/collections/{collectionID}/schema-migration": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get the active schema migration
     * @description Returns the active migration for a collection, or null when none is active.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["schemaMigrations.getActive"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schema-migrations/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get schema migration status
     * @description Returns bounded migration progress and status. Use schemaMigrations.listContentLossEntries for per-entry content loss details. Check status before repeating an operation blocked by this migration.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["schemaMigrations.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schemas/{schemaID}/versions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List schema versions
     * @description Lists versions of a local collection schema. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["schemaVersions.list"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/schema-versions/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get a schema version
     * @description Returns a saved schema version and its definition.
     *
     *     Required API key permissions: read:collections. Write permissions also grant read access for the same resource.
     */
    get: operations["schemaVersions.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Rename a schema version
     * @description Changes the saved version name. Set name to null to remove the name.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    patch: operations["schemaVersions.update"];
    trace?: never;
  };
  "/schema-versions/{id}/revert": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Restore a schema version
     * @description Restores the selected definition and starts any required content migration. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.
     *
     *     Required API key permissions: collections. Write permissions also grant read access for the same resource.
     */
    post: operations["schemaVersions.revert"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/memberships": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List workspace members
     * @description Lists workspace memberships with role and user details. Use pagination.nextCursor to continue with the same filters; concurrent changes can affect later pages.
     *
     *     Required API key permissions: read:memberships. Write permissions also grant read access for the same resource.
     */
    get: operations["memberships.list"];
    put?: never;
    /**
     * Invite a workspace member
     * @description Creates an invitation and attempts email delivery. Check emailDelivery in the result. Requires the Pro plan and permission to delegate the selected role. Existing membership or pending invitation returns a conflict.
     *
     *     Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     */
    post: operations["memberships.invite"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/memberships/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Remove a workspace member
     * @description Removes the membership and its workspace access. Administrator memberships have additional restrictions.
     *
     *     Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     */
    delete: operations["memberships.remove"];
    options?: never;
    head?: never;
    /**
     * Change a member role
     * @description Assigns a new role to a member. Requires the Pro plan and permission to delegate that role. Administrator assignments have additional restrictions.
     *
     *     Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     */
    patch: operations["memberships.update"];
    trace?: never;
  };
  "/memberships/invites": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List invitations
     * @description Lists pending, unexpired workspace invitations. Use pagination.nextCursor to continue. Requires the Pro plan.
     *
     *     Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     */
    get: operations["memberships.listInvites"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/memberships/invites/{id}/resend": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Resend an invitation
     * @description Attempts email delivery again for a pending invitation. Check emailDelivery in the result. Requires the Pro plan.
     *
     *     Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     */
    post: operations["memberships.resendInvite"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/memberships/invites/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Revoke an invitation
     * @description Revokes a pending invitation so it can no longer be accepted. Requires the Pro plan.
     *
     *     Required API key permissions: memberships. Write permissions also grant read access for the same resource.
     */
    delete: operations["memberships.revokeInvite"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/collections/{collectionID}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /**
     * Configure collection publishing
     * @description Enables publishing for a collection, or disables it and unpublishes its tree from all channels. When enabling, publish can also publish the latest entry versions.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    put: operations["publishing.setCollection"];
    /**
     * Publish a collection tree
     * @description Publishes the latest entry versions in a publishing-enabled collection tree to the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.publishCollection"];
    /**
     * Unpublish a collection tree
     * @description Removes publication assignments for a collection tree from the channel. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    delete: operations["publishing.unpublishCollection"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/collections/bulk/set": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Configure publishing for collections
     * @description Enables publishing for the selected collections, or disables it and unpublishes their trees from all channels. When enabling, publish can also publish the latest entry versions.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.bulkSetCollections"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/collections/bulk/publish": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Publish collection trees
     * @description Publishes the latest entry versions in the selected publishing-enabled collection trees. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.bulkPublishCollections"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/collections/bulk/unpublish": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Unpublish collection trees
     * @description Removes publication assignments for the selected collection trees from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.bulkUnpublishCollections"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/entries/{entryID}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Publish an entry
     * @description Publishes an existing version, or the latest entry content if versionID is omitted. The entry must be in a publishing-enabled collection. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.publishEntry"];
    /**
     * Unpublish an entry
     * @description Removes the entry publication from the channel. Supply versionID to require that version to be assigned; a changed assignment returns a conflict. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    delete: operations["publishing.unpublishEntry"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/entries/bulk/publish": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Publish entries
     * @description Publishes the selected entries with optional version IDs. Entries must be in publishing-enabled collections. At least one entry is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.bulkPublishEntries"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/entries/bulk/unpublish": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Unpublish entries
     * @description Removes publication assignments for the selected entries from the channel. At least one ID is required. The default channel is published. Supply expectedSnapshotID from a prior channel read to reject concurrent publication changes.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.bulkUnpublishEntries"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/changes/revert": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Revert pending publishing changes
     * @description Restores selected drafts to the reviewed publication snapshot. This can remove unpublished items and replace draft content. First review publishing.getChannelContent and pass its snapshotID. Use all: true or specific collectionIDs/entryIDs, never both. Requires write access to affected resources in addition to read:publishing.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.revertChanges"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/entries/{entryID}/version": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get a published entry version
     * @description Returns the entry version assigned to a channel, or to an explicit available snapshot, with its recorded schema metadata. Validates content against that revision. expectedSchemaHash must match it; schema-less content cannot match it. The default channel is published.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["publishing.getEntryVersion"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/entries/{entryID}/publications": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List entry publications
     * @description Returns the entry publication assignments across channels.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["publishing.listEntryPublications"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/channels": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List publishing channels
     * @description Returns workspace publishing channels. Set includeAssignmentCount to include entry assignment counts.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["publishing.listChannels"];
    put?: never;
    /**
     * Create a publishing channel
     * @description Creates a publishing channel from its display name and returns the generated channel code.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    post: operations["publishing.createChannel"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/channels/{channel}/content": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get channel content and pending changes
     * @description Returns publication state and pending changes for a publishing root, with the snapshot ID needed to review and revert changes.
     *
     *     Required API key permissions: read:publishing. Write permissions also grant read access for the same resource.
     */
    get: operations["publishing.getChannelContent"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/publishing/channels/{code}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Delete a publishing channel
     * @description Deletes a custom channel and its publication assignments. The default published channel cannot be deleted.
     *
     *     Required API key permissions: publishing. Write permissions also grant read access for the same resource.
     */
    delete: operations["publishing.deleteChannel"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/entries/{entryID}/versions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List entry versions
     * @description Lists saved entry versions. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.
     *
     *     Required API key permissions: read:versions. Write permissions also grant read access for the same resource.
     */
    get: operations["versions.list"];
    put?: never;
    /**
     * Create an entry version
     * @description Saves a version of the current entry content. Optionally assigns a name.
     *
     *     Required API key permissions: versions. Write permissions also grant read access for the same resource.
     */
    post: operations["versions.create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/versions/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get an entry version
     * @description Returns the saved content and recorded schema metadata of an entry version. Validates against its recorded revision, including historical versions. expectedSchemaHash must match that revision; schema-less content cannot match it.
     *
     *     Required API key permissions: read:versions. Write permissions also grant read access for the same resource.
     */
    get: operations["versions.get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Rename an entry version
     * @description Changes the saved version name. Set name to null to remove the name.
     *
     *     Required API key permissions: versions. Write permissions also grant read access for the same resource.
     */
    patch: operations["versions.update"];
    trace?: never;
  };
  "/versions/{id}/revert": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Restore an entry version
     * @description Restores saved content to the current entry and returns the resulting version. An active schema migration can block this action.
     *
     *     Required API key permissions: versions. Write permissions also grant read access for the same resource.
     */
    post: operations["versions.revert"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    AnswerEvent:
      | {
          /** @constant */
          type: "sources";
          sources: components["schemas"]["AnswerSource"][];
        }
      | {
          /** @constant */
          type: "textDelta";
          text: string;
        }
      | {
          answer: string;
          sources: components["schemas"]["AnswerSource"][];
          /** @constant */
          type: "completed";
        };
    PublishedAnswerEvent:
      | {
          /** @constant */
          type: "sources";
          sources: components["schemas"]["PublishedAnswerSource"][];
        }
      | {
          /** @constant */
          type: "textDelta";
          text: string;
        }
      | {
          answer: string;
          sources: components["schemas"]["PublishedAnswerSource"][];
          /** @constant */
          type: "completed";
        };
    AnswerSource: {
      path: string;
      anchor?: string;
      entryID: string;
      collectionID?: string;
      collectionPath: string[];
      headingPath: string[];
      title: string;
      snippet: string;
      properties: components["schemas"]["SearchPropertyValue"][];
      /** Format: date-time */
      updatedAt: string;
      channel?: components["schemas"]["PublishingChannelCode"];
      versionID?: string;
      snapshotID?: string;
      id: number;
      relevance: number;
    };
    PublishedAnswerSource: {
      path: string;
      anchor?: string;
      entryID: string;
      collectionID?: string;
      collectionPath: string[];
      headingPath: string[];
      title: string;
      snippet: string;
      properties: components["schemas"]["SearchPropertyValue"][];
      /** Format: date-time */
      updatedAt: string;
      channel: components["schemas"]["PublishingChannelCode"];
      versionID: string;
      snapshotID: string;
      id: number;
      relevance: number;
    };
    Answer: {
      answer: string;
      sources: components["schemas"]["AnswerSource"][];
    };
    PublishedAnswer: {
      answer: string;
      sources: components["schemas"]["PublishedAnswerSource"][];
    };
    AnswerHistoryMessage: {
      /** @enum {string} */
      role: "user" | "assistant";
      content: string;
    };
    ContentSchemaMetadata: {
      /** @description Recorded effective schema revision */
      revisionID: string;
      /** @description Hash of the effective schema definition */
      hash: string;
    };
    SchemaRevision: {
      /** @description Recorded effective schema revision */
      revisionID: string;
      /** @description Hash of the effective schema definition */
      hash: string;
      /** @description Exact effective definition, including inherited fields */
      definition: {
        /** @constant */
        formatVersion: 1;
        fields: components["schemas"]["SchemaField"][];
      };
    };
    ContentSchemaIssue: {
      /** @enum {string} */
      code:
        | "invalid_schema"
        | "invalid_structure"
        | "missing_field"
        | "unknown_field"
        | "duplicate_field"
        | "field_kind_mismatch"
        | "field_key_mismatch"
        | "property_type_mismatch"
        | "invalid_property_value"
        | "invalid_field_options"
        | "invalid_allowed_blocks"
        | "invalid_fragment_content";
      message: string;
      path: (string | number)[];
      fieldID?: string;
    };
    ContentSchemaInvalidErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      entryID?: string;
      versionID?: string;
      revisionID: string | null;
      issues: components["schemas"]["ContentSchemaIssue"][];
    };
    ContentSchemaMismatchErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      /** @description Hash of the effective schema definition */
      expectedHash: string;
      actualSchema: components["schemas"]["ContentSchemaMetadata"] | null;
    };
    SchemaFieldKeyConflictErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      key: string;
      /** @enum {string} */
      kind: "fragment" | "property";
      fieldIDs: string[];
    };
    PublishedEntryContent: {
      id: string;
      path: string;
      collectionID: string | null;
      schema: components["schemas"]["ContentSchemaMetadata"] | null;
      /** @description Entry name stored in the published version */
      name: string;
      version: components["schemas"]["EntryVersionSummary"];
      assets: components["schemas"]["PublishedAsset"][];
      content: components["schemas"]["ContentNode"];
      fragments: {
        [key: string]: components["schemas"]["EntryFragment"];
      };
      properties: {
        [key: string]: components["schemas"]["EntryProperty"];
      };
    };
    PublishedEntrySummary: {
      path: string;
      /** @description ID of the published entry */
      id: string;
      /** @description Entry name stored in the published version */
      name: string;
      version: components["schemas"]["PublishedVersion"];
      collectionID: string | null;
    };
    PublishedCollectionSummary: {
      path: string;
      id: string;
      parentID: string | null;
      name: string;
    };
    InstanceInfo: {
      /** @description API contract version, not the server build version */
      apiVersion: string;
      /** @description Configured availability; does not imply permission or current service health */
      features: {
        imageStorage: boolean;
        semanticSearch: boolean;
        /** @description Whether AI answers are configured */
        aiAnswers: boolean;
        /** @description Whether streaming AI answers are configured */
        aiAnswerStreaming: boolean;
      };
      limits: {
        maxUploadBytes: number;
        assetStorageBytes: number;
        defaultPageSize: number;
        maxPageSize: number;
        maxBulkItems: number;
        maxSearchResults: number;
      };
    };
    AssetValidationErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      issues?: components["schemas"]["ValidationIssue"][];
      assetID?: string;
      expectedByteSize?: number;
      actualByteSize?: number;
      expectedChecksum?: string;
      actualChecksum?: string;
    };
    AssetConflictErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      assetID?: string;
      assetStatus?: components["schemas"]["AssetStatus"];
    };
    AssetStorageErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      missingPermissions?: string[];
      /** @constant */
      requiredPlan?: "pro";
      /** @description The requested action that was denied */
      action?: string;
      limitBytes?: number;
      usedBytes?: number;
      /** @description Additional space reserved for this upload, including processed image variants */
      requiredBytes?: number;
    };
    ContentNameConflictErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      name: string;
      parentID: string | null;
    };
    ErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
    };
    ValidationIssue: {
      message: string;
      code?: string;
      path?: (
        | string
        | number
        | {
            key: string | number;
          }
      )[];
    };
    ValidationErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      issues?: components["schemas"]["ValidationIssue"][];
    };
    ForbiddenErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      missingPermissions?: string[];
      /** @constant */
      requiredPlan?: "pro";
      /** @description The requested action that was denied */
      action?: string;
    };
    RateLimitErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      /** @description Minimum delay before another attempt, in seconds. Also sent in Retry-After. */
      retryAfterSeconds?: number;
    };
    SchemaMigrationErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      migrationID: string;
    };
    PublishingSnapshotErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      channel: string;
      expectedSnapshotID: string;
      currentSnapshotID: string;
    };
    MembershipExistsErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      membershipID: string;
    };
    InvitePendingErrorData: {
      /** @description Suggested next steps. Wording can change; use error codes and structured data for program logic. */
      hints?: string[];
      inviteID: string;
    };
    EntrySummary: {
      /** @description ID of the entry */
      id: string;
      /** @description Name of the entry */
      name: string;
      /** @description LexoRank order of the entry */
      order: string;
      /** @description ID of the collection this entry belongs to */
      collectionID?: string;
      path: string;
    };
    Collection: {
      /** @description ID of the collection */
      id: string;
      /** @description Name of the collection */
      name: string;
      /** @description Whether the collection starts a restricted-access boundary */
      restricted: boolean;
      ancestors: string[];
      descendants: string[];
      path: string;
    };
    Role: {
      /** @description ID of the role */
      id: string;
      /** @description Name of the role */
      name: string;
      /** @description Permissions granted to the role */
      permissions: components["schemas"]["Permission"][];
      /** @description If this role is an unremovable base role */
      baseRole?: components["schemas"]["BaseRole"];
    };
    /** @enum {string} */
    Permission:
      | "content"
      | "publishing"
      | "api_keys"
      | "read:api_keys"
      | "billing"
      | "read:billing"
      | "restricted_collections"
      | "read:restricted_collections"
      | "memberships"
      | "roles"
      | "workspace";
    /** @enum {string} */
    BaseRole: "admin" | "viewer";
    /** @enum {string} */
    InviteStatus: "pending" | "accepted" | "expired";
    UserProfile: {
      /** @description ID of the user */
      id: string;
      /** @description User's full name */
      name?: string;
      /**
       * Format: email
       * @description Email address
       */
      email: string;
      /** @description URL of the user's avatar image */
      image?: string;
    };
    ContentNode: {
      type: string;
      attrs?: {
        [key: string]: unknown;
      };
      content?: components["schemas"]["ContentNode"][];
      marks?: components["schemas"]["ContentMark"][];
      text?: string;
    };
    ContentNodeInput: {
      type: string;
      attrs?: {
        [key: string]: unknown;
      };
      content?: components["schemas"]["ContentNodeInput"][];
      marks?: components["schemas"]["ContentMark"][];
      text?: string;
    };
    ContentMark: {
      type: string;
      attrs?: {
        [key: string]: unknown;
      };
    };
    ContentMarkInput: {
      type: string;
      attrs?: {
        [key: string]: unknown;
      };
    };
    EntryVersion: {
      /** @description ID of the version */
      id: string;
      /** @description ID of the versioned entry */
      entryID: string;
      /** @description Entry name stored in the version */
      entryName: string;
      /** @description Hash of the version content */
      hash: string;
      /** @description Optional name of the version */
      name: string | null;
      /**
       * @description Reason why the version was created
       * @enum {string}
       */
      reason: "auto" | "manual" | "revert" | "schema-migration";
      /** @description Source version used for a revert */
      sourceVersionID: string | null;
      /** @description Memberships that contributed to the version */
      contributorIDs: string[];
      /**
       * Format: date-time
       * @description Time when the version was created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description Time when the version name was last updated
       */
      updatedAt: string;
      schema: components["schemas"]["ContentSchemaMetadata"] | null;
      /** @description ProseMirror JSON stored in the version */
      document: {
        type: string;
        attrs?: {
          [key: string]: unknown;
        };
        content?: components["schemas"]["ContentNode"][];
        marks?: components["schemas"]["ContentMark"][];
        text?: string;
      };
    };
    EntryVersionSummary: {
      /** @description ID of the version */
      id: string;
      /** @description ID of the versioned entry */
      entryID: string;
      /** @description Entry name stored in the version */
      entryName: string;
      /** @description Hash of the version content */
      hash: string;
      /** @description Optional name of the version */
      name: string | null;
      /**
       * @description Reason why the version was created
       * @enum {string}
       */
      reason: "auto" | "manual" | "revert" | "schema-migration";
      /** @description Source version used for a revert */
      sourceVersionID: string | null;
      /** @description Memberships that contributed to the version */
      contributorIDs: string[];
      /**
       * Format: date-time
       * @description Time when the version was created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description Time when the version name was last updated
       */
      updatedAt: string;
    };
    /** @enum {string} */
    VersionReason: "auto" | "manual" | "revert" | "schema-migration";
    CollectionSchema: {
      local: components["schemas"]["LocalCollectionSchema"] | null;
      effective: components["schemas"]["EffectiveCollectionSchema"] | null;
    };
    LocalCollectionSchema: {
      /** @description ID of the local collection schema */
      id: string;
      /** @description ID of the collection */
      collectionID: string;
      /** @description Whether the collection currently defines a local schema */
      enabled: boolean;
      /** @description Current local schema draft */
      draft: components["schemas"]["SchemaDraftDefinition"] | null;
      /** @description Current draft projected as an editor document */
      draftDocument: components["schemas"]["ContentNode"] | null;
      /** @description Hash of the current local schema draft */
      draftHash: string | null;
      /** @description Whether the draft differs from the active version */
      hasUnappliedChanges: boolean;
      activeVersion: components["schemas"]["SchemaVersionSummary"] | null;
      /**
       * Format: date-time
       * @description Time when the local schema was first created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description Time when the local schema draft was last updated
       */
      updatedAt: string;
    };
    EffectiveCollectionSchema: {
      /** @description ID of the effective schema revision */
      id: string;
      /** @description ID of the collection */
      collectionID: string;
      /** @description Effective inherited schema definition */
      definition: {
        /** @constant */
        formatVersion: 1;
        fields: components["schemas"]["ResolvedSchemaField"][];
        sourceVersionIDs: string[];
      };
      /** @description Effective schema projected as an editor document */
      document: {
        type: string;
        attrs?: {
          [key: string]: unknown;
        };
        content?: components["schemas"]["ContentNode"][];
        marks?: components["schemas"]["ContentMark"][];
        text?: string;
      };
      /** @description Hash of the effective schema definition */
      hash: string;
      /** @description Whether the effective schema is fully inherited */
      inherited: boolean;
      /**
       * Format: date-time
       * @description Time when the effective revision was created
       */
      createdAt: string;
    };
    SchemaVersion: {
      /** @description ID of the schema version */
      id: string;
      /** @description ID of the local collection schema */
      schemaID: string;
      /** @description ID of the collection */
      collectionID: string;
      /** @description Sequential schema version number */
      version: number;
      /** @description Hash of the schema definition */
      hash: string;
      /** @description Optional schema version name */
      name: string | null;
      /**
       * @description Reason why the schema version was created
       * @enum {string}
       */
      reason: "auto" | "manual" | "revert" | "schema-migration";
      /** @description Source version used for a revert */
      sourceVersionID: string | null;
      /** @description Whether this is the active local schema version */
      active: boolean;
      /** @description Membership that applied the schema version */
      appliedBy: string | null;
      /** @description Memberships that contributed to the schema version */
      contributorIDs: string[];
      /**
       * Format: date-time
       * @description Time when the schema version was created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description Time when the schema version name was last updated
       */
      updatedAt: string;
      /** @description Local schema definition stored in the version */
      definition: {
        /** @constant */
        formatVersion: 1;
        fields: components["schemas"]["SchemaField"][];
      };
      /** @description Schema definition projected as an editor document */
      document: {
        type: string;
        attrs?: {
          [key: string]: unknown;
        };
        content?: components["schemas"]["ContentNode"][];
        marks?: components["schemas"]["ContentMark"][];
        text?: string;
      };
    };
    SchemaVersionSummary: {
      /** @description ID of the schema version */
      id: string;
      /** @description ID of the local collection schema */
      schemaID: string;
      /** @description ID of the collection */
      collectionID: string;
      /** @description Sequential schema version number */
      version: number;
      /** @description Hash of the schema definition */
      hash: string;
      /** @description Optional schema version name */
      name: string | null;
      /**
       * @description Reason why the schema version was created
       * @enum {string}
       */
      reason: "auto" | "manual" | "revert" | "schema-migration";
      /** @description Source version used for a revert */
      sourceVersionID: string | null;
      /** @description Whether this is the active local schema version */
      active: boolean;
      /** @description Membership that applied the schema version */
      appliedBy: string | null;
      /** @description Memberships that contributed to the schema version */
      contributorIDs: string[];
      /**
       * Format: date-time
       * @description Time when the schema version was created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description Time when the schema version name was last updated
       */
      updatedAt: string;
    };
    SchemaApplicationResult: {
      /** @description Whether a new schema version was created for application */
      changed: boolean;
      /** @description ID of the migration, or null when entry conversion is not needed */
      migrationID: string | null;
      /** @description ID of the schema version associated with the application */
      schemaVersionID: string;
      /** @description Collections affected by the effective schema */
      affectedCollectionIDs: string[];
      /** @description Entries that require content migration */
      totalEntries: number;
    };
    SchemaMigration: {
      /** @description ID of the schema migration */
      id: string;
      /** @description Local schema that initiated the migration */
      schemaID: string | null;
      /** @description Schema version applied by the migration */
      schemaVersionID: string | null;
      status: components["schemas"]["SchemaMigrationStatus"];
      totalEntries: number;
      processedEntries: number;
      error: string | null;
      initiatedBy: string | null;
      startedAt: string | null;
      completedAt: string | null;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: string;
    };
    /** @enum {string} */
    SchemaMigrationStatus: "queued" | "running" | "rolling_back" | "completed" | "failed";
    SchemaMigrationContentLossEntry: {
      /** @description ID of an entry that lost content */
      id: string;
      /** @description ID of the entry collection */
      collectionID: string;
      /** @description Current entry name */
      name: string;
    };
    SchemaDefinition: {
      /** @constant */
      formatVersion: 1;
      fields: components["schemas"]["SchemaField"][];
    };
    SchemaDraftDefinition: {
      /** @constant */
      formatVersion: 1;
      fields: components["schemas"]["SchemaField"][];
    };
    SchemaField: components["schemas"]["SchemaProperty"] | components["schemas"]["SchemaFragment"];
    SchemaProperty: {
      id: string;
      /** @constant */
      kind: "property";
      label: string;
      /** @enum {string} */
      type: "text" | "number" | "checkbox" | "date" | "url" | "select" | "multi-select";
      defaultValue: components["schemas"]["SchemaPropertyValue"];
      options: string[];
    };
    SchemaPropertyValue: boolean | string | string[];
    SchemaFragment: {
      id: string;
      /** @constant */
      kind: "fragment";
      label: string;
      allowedBlocks: components["schemas"]["SchemaBlockType"][];
      defaultContent: components["schemas"]["ContentNode"][];
    };
    /** @enum {string} */
    SchemaBlockType:
      | "heading"
      | "blockquote"
      | "bulletList"
      | "orderedList"
      | "taskList"
      | "horizontalRule"
      | "codeBlock"
      | "table"
      | "element"
      | "image";
    ResolvedSchemaDefinition: {
      /** @constant */
      formatVersion: 1;
      fields: components["schemas"]["ResolvedSchemaField"][];
      sourceVersionIDs: string[];
    };
    ResolvedSchemaField: components["schemas"]["SchemaField"] & {
      source: components["schemas"]["SchemaFieldSource"];
    };
    SchemaFieldSource: {
      collectionID: string;
      inherited: boolean;
      schemaID: string;
      versionID: string;
    };
    PublishingChannelCode: string;
    Entry: {
      /** @description ID of the entry */
      id: string;
      /** @description Name of the entry */
      name: string;
      /** @description LexoRank order of the entry */
      order: string;
      /** @description ID of the collection this entry belongs to */
      collectionID?: string;
      path: string;
      schema: components["schemas"]["ContentSchemaMetadata"] | null;
      /**
       * Format: date-time
       * @description Time when the entry content was last updated
       */
      updatedAt: string;
      content: components["schemas"]["ContentNode"];
      fragments: {
        [key: string]: components["schemas"]["EntryFragment"];
      };
      properties: {
        [key: string]: components["schemas"]["EntryProperty"];
      };
    };
    EntryFragment: {
      /** @description Source fragment name */
      name: string;
      content: components["schemas"]["ContentNode"];
    };
    EntryProperty: {
      /** @description Source property name */
      name: string;
      /**
       * @description Property type
       * @enum {string}
       */
      type: "text" | "number" | "checkbox" | "date" | "url" | "select" | "multi-select";
      value: components["schemas"]["EntryPropertyValue"];
    };
    /** @enum {string} */
    EntryPropertyKind: "text" | "number" | "checkbox" | "date" | "url" | "select" | "multi-select";
    EntryPropertyValue: string | number | boolean | string[] | null;
    Pagination: {
      nextCursor: string | null;
      hasMore: boolean;
    };
    Asset: {
      assetID: string;
      filename: string;
      status: components["schemas"]["AssetStatus"];
      failureReason: string | null;
      analysis: components["schemas"]["AssetAnalysis"] | null;
      files: components["schemas"]["AssetFile"][];
    };
    AssetAnalysis: {
      status: components["schemas"]["AssetAnalysisStatus"];
      description: string | null;
      extractedText: string | null;
    };
    /** @enum {string} */
    AssetAnalysisStatus: "pending" | "processing" | "ready" | "failed";
    /** @enum {string} */
    AssetStatus: "pending" | "processing" | "ready" | "failed" | "deleting";
    AssetFile: {
      variant: components["schemas"]["AssetVariant"];
      format: components["schemas"]["AssetFileFormat"];
      byteSize: number;
      width: number;
      height: number;
      /** Format: uri */
      url: string;
      /** Format: date-time */
      expiresAt: string;
    };
    /** @enum {string} */
    AssetFileFormat: "jpeg" | "png" | "webp";
    /** @enum {string} */
    AssetVariant: "thumbnail" | "display";
    AssetSearchResult: {
      assetID: string;
      entryID: string;
      entryName: string;
      filename: string;
      description: string;
      /** Format: uri */
      thumbnailURL: string;
      width: number;
      height: number;
    };
    AssetUploadRegistration: {
      assetID: string;
      /** Format: date-time */
      expiresAt: string;
    };
    Membership: {
      /** @description ID of the membership */
      id: string;
      /** @description ID of the user */
      userID: string;
      /** @description ID of the role */
      roleID: string;
      /** @description Name of the member's assigned role */
      roleName?: string;
      /** @description Whether the member is an admin */
      admin?: boolean;
      /** @description Public profile information for the member */
      profile: {
        /** @description ID of the user */
        id: string;
        /** @description User's full name */
        name?: string;
        /**
         * Format: email
         * @description Email address
         */
        email: string;
        /** @description URL of the user's avatar image */
        image?: string;
      };
    };
    Invite: {
      /** @description ID of the invite */
      id: string;
      /**
       * Format: email
       * @description Email address of the invited user
       */
      email: string;
      /** @description ID of the role to assign */
      roleID: string;
      /** @description ID of the member who created the invite */
      invitedBy?: string;
      /**
       * @description Current status of the invite
       * @enum {string}
       */
      status: "pending" | "accepted" | "expired";
      /**
       * Format: date-time
       * @description When the invite was created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description When the invite expires
       */
      expiresAt: string;
      /**
       * Format: uri
       * @description Signed URL for accepting the invitation
       */
      inviteLink: string;
      /** @description ID of the workspace the invite belongs to */
      workspaceID: string;
    };
    MembershipInviteResult: {
      /** @description ID of the invite */
      inviteID: string;
      /**
       * Format: uri
       * @description Invite link that can be shared manually
       */
      inviteLink: string;
      /**
       * @description Whether the invite email was sent, must be shared manually, or failed
       * @enum {string}
       */
      emailDelivery: "sent" | "manual" | "failed";
    };
    InviteDeliveryResult: {
      /**
       * @description Whether the invitation email was sent, must be shared manually, or failed
       * @enum {string}
       */
      emailDelivery: "sent" | "manual" | "failed";
    };
    PublishedContent: {
      id: string;
      path: string;
      collectionID: string | null;
      schema: components["schemas"]["ContentSchemaMetadata"] | null;
      /** @description Publishing channel used for delivery */
      channel: string;
      /** @description Publication snapshot used for delivery */
      snapshotID: string;
      /** @description Expiry time for a retained historical snapshot */
      expiresAt: string | null;
      /** @description Entry name stored in the published version */
      name: string;
      version: components["schemas"]["EntryVersionSummary"];
      assets: components["schemas"]["PublishedAsset"][];
      content: components["schemas"]["ContentNode"];
      fragments: {
        [key: string]: components["schemas"]["EntryFragment"];
      };
      properties: {
        [key: string]: components["schemas"]["EntryProperty"];
      };
    };
    PublishedAsset: {
      assetID: string;
      variant: components["schemas"]["AssetVariant"];
      format: components["schemas"]["AssetFileFormat"];
      width: number;
      height: number;
      byteSize: number;
      /** Format: uri */
      url: string;
    };
    PublishedEntry: {
      path: string;
      /** @description ID of the published entry */
      id: string;
      /** @description Entry name stored in the published version */
      name: string;
      version: components["schemas"]["PublishedVersion"];
    };
    PublishedVersion: {
      /** @description ID of the assigned version */
      id: string;
      /** @description Hash of the assigned version content */
      hash: string;
    };
    PublishedCollection: {
      /** @description Collection ID, or null for the virtual root */
      id: string | null;
      path: string;
      /** @description Name of the collection */
      name: string;
      entries: components["schemas"]["PublishedEntry"][];
      collections: components["schemas"]["PublishedCollection"][];
    };
    PublishedTree: {
      channel: components["schemas"]["PublishingChannelCode"];
      /** @description Publication snapshot used for delivery */
      snapshotID: string;
      /** @description Expiry time for a retained historical snapshot */
      expiresAt: string | null;
      collection: components["schemas"]["PublishedCollection"];
    };
    PublishingChannel: {
      /** @description Publishing channel API identifier */
      code: string;
      /** @description Publishing channel label */
      name: string;
      /** @description Whether the channel is built in */
      builtIn: boolean;
      /**
       * Format: date-time
       * @description Time when the channel was created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description Time when the channel was last updated
       */
      updatedAt: string;
    };
    PublishingChannelListItem: {
      /** @description Publishing channel API identifier */
      code: string;
      /** @description Publishing channel label */
      name: string;
      /** @description Whether the channel is built in */
      builtIn: boolean;
      /**
       * Format: date-time
       * @description Time when the channel was created
       */
      createdAt: string;
      /**
       * Format: date-time
       * @description Time when the channel was last updated
       */
      updatedAt: string;
      assignmentCount?: number;
    };
    EntryPublication: {
      channel: components["schemas"]["EntryPublicationChannel"];
      /**
       * Format: date-time
       * @description Time when the version was published
       */
      publishedAt: string;
      version: components["schemas"]["EntryVersionSummary"];
    };
    EntryPublicationChannel: {
      /** @description Whether the channel is built in */
      builtIn: boolean;
      /** @description Publishing channel API identifier */
      code: string;
      /** @description Publishing channel label */
      name: string;
    };
    ChannelContent: {
      channel: components["schemas"]["PublishingChannelCode"];
      collections: components["schemas"]["ChannelContentCollection"][];
      entries: components["schemas"]["ChannelContentEntry"][];
      snapshotID: string;
    };
    ChannelContentEntry: {
      /** @description Whether current permissions allow publishing this entry */
      canPublish: boolean;
      /** @description Whether current permissions allow reverting this entry */
      canRevert: boolean;
      /** @description Whether current permissions allow unpublishing this entry */
      canUnpublish: boolean;
      /** @description Current working collection */
      collectionID: string | null;
      /** @description Whether the working entry is deleted */
      deleted: boolean;
      entryID: string;
      name: string;
      publishedAt: string | null;
      rank: string;
      status: components["schemas"]["ChannelContentStatus"];
      /** @description Collection used to place the entry in the tree */
      treeCollectionID: string | null;
      /** @description Version selected by the current snapshot */
      versionID: string | null;
    };
    ChannelContentCollection: {
      /** @description Whether current permissions allow publishing this collection */
      canPublish: boolean;
      /** @description Whether current permissions allow reverting this collection */
      canRevert: boolean;
      /** @description Whether current permissions allow unpublishing this collection */
      canUnpublish: boolean;
      collectionID: string;
      /** @description Whether the working collection is deleted */
      deleted: boolean;
      name: string;
      parentID: string | null;
      rank: string;
      status: components["schemas"]["ChannelContentStatus"];
    };
    /** @enum {string} */
    ChannelContentStatus: "changes" | "pending-publish" | "pending-removal" | "published";
    PublishEntryTarget: {
      /** @description Entry to publish */
      entryID: string;
      /** @description Existing version to publish */
      versionID?: string;
    };
    RevertPublishingChangesResult: {
      affectedEntryIDs: string[];
      deletedEntryIDs: string[];
      noOp: boolean;
      restoredEntryIDs: string[];
      versionedEntryIDs: string[];
    };
    PublishedEntriesResult: {
      /** @description Number of entries published */
      publishedEntries: number;
    };
    UnpublishedEntriesResult: {
      /** @description Number of entries unpublished */
      unpublishedEntries: number;
    };
    PropertyFilter:
      | components["schemas"]["TextPropertyFilter"]
      | components["schemas"]["NumberPropertyFilter"]
      | components["schemas"]["BooleanPropertyFilter"]
      | components["schemas"]["DatePropertyFilter"];
    TextPropertyFilter: {
      /** @constant */
      kind: "text";
      /** @description Property identifier */
      key: string;
      /**
       * @default any
       * @enum {string}
       */
      operator?: "any" | "all" | "none";
      values: string[];
    };
    NumberPropertyFilter: {
      /** @constant */
      kind: "number";
      /** @description Property identifier */
      key: string;
      operator: components["schemas"]["ComparisonOperator"];
      value: number;
    };
    BooleanPropertyFilter: {
      /** @constant */
      kind: "boolean";
      /** @description Property identifier */
      key: string;
      value: boolean;
    };
    DatePropertyFilter: {
      /** @constant */
      kind: "date";
      /** @description Property identifier */
      key: string;
      operator: components["schemas"]["ComparisonOperator"];
      value: string;
    };
    /** @enum {string} */
    ComparisonOperator:
      | "equals"
      | "notEquals"
      | "greaterThan"
      | "greaterThanOrEqual"
      | "lessThan"
      | "lessThanOrEqual";
    SearchPropertyValue: {
      key: string;
      name: string;
      type: components["schemas"]["EntryPropertyKind"];
      textValue?: string[];
      numberValue?: number;
      booleanValue?: boolean;
      dateValue?: number;
    };
    PublishedSearchResult: {
      path: string;
      anchor?: string;
      entryID: string;
      collectionID?: string;
      collectionPath: string[];
      headingPath: string[];
      title: string;
      snippet: string;
      properties: components["schemas"]["SearchPropertyValue"][];
      /** Format: date-time */
      updatedAt: string;
      channel: components["schemas"]["PublishingChannelCode"];
      versionID: string;
      snapshotID: string;
    };
    SearchResult: {
      path: string;
      anchor?: string;
      entryID: string;
      collectionID?: string;
      collectionPath: string[];
      headingPath: string[];
      title: string;
      snippet: string;
      properties: components["schemas"]["SearchPropertyValue"][];
      /** Format: date-time */
      updatedAt: string;
      channel?: components["schemas"]["PublishingChannelCode"];
      versionID?: string;
      snapshotID?: string;
    };
    SearchResults: {
      results: components["schemas"]["SearchResult"][];
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type AnswerEvent = components["schemas"]["AnswerEvent"];
export type PublishedAnswerEvent = components["schemas"]["PublishedAnswerEvent"];
export type AnswerSource = components["schemas"]["AnswerSource"];
export type PublishedAnswerSource = components["schemas"]["PublishedAnswerSource"];
export type Answer = components["schemas"]["Answer"];
export type PublishedAnswer = components["schemas"]["PublishedAnswer"];
export type AnswerHistoryMessage = components["schemas"]["AnswerHistoryMessage"];
export type ContentSchemaMetadata = components["schemas"]["ContentSchemaMetadata"];
export type SchemaRevision = components["schemas"]["SchemaRevision"];
export type ContentSchemaIssue = components["schemas"]["ContentSchemaIssue"];
export type ContentSchemaInvalidErrorData = components["schemas"]["ContentSchemaInvalidErrorData"];
export type ContentSchemaMismatchErrorData =
  components["schemas"]["ContentSchemaMismatchErrorData"];
export type SchemaFieldKeyConflictErrorData =
  components["schemas"]["SchemaFieldKeyConflictErrorData"];
export type PublishedEntryContent = components["schemas"]["PublishedEntryContent"];
export type PublishedEntrySummary = components["schemas"]["PublishedEntrySummary"];
export type PublishedCollectionSummary = components["schemas"]["PublishedCollectionSummary"];
export type InstanceInfo = components["schemas"]["InstanceInfo"];
export type AssetValidationErrorData = components["schemas"]["AssetValidationErrorData"];
export type AssetConflictErrorData = components["schemas"]["AssetConflictErrorData"];
export type AssetStorageErrorData = components["schemas"]["AssetStorageErrorData"];
export type ContentNameConflictErrorData = components["schemas"]["ContentNameConflictErrorData"];
export type ErrorData = components["schemas"]["ErrorData"];
export type ValidationIssue = components["schemas"]["ValidationIssue"];
export type ValidationErrorData = components["schemas"]["ValidationErrorData"];
export type ForbiddenErrorData = components["schemas"]["ForbiddenErrorData"];
export type RateLimitErrorData = components["schemas"]["RateLimitErrorData"];
export type SchemaMigrationErrorData = components["schemas"]["SchemaMigrationErrorData"];
export type PublishingSnapshotErrorData = components["schemas"]["PublishingSnapshotErrorData"];
export type MembershipExistsErrorData = components["schemas"]["MembershipExistsErrorData"];
export type InvitePendingErrorData = components["schemas"]["InvitePendingErrorData"];
export type EntrySummary = components["schemas"]["EntrySummary"];
export type Collection = components["schemas"]["Collection"];
export type Role = components["schemas"]["Role"];
export type Permission = components["schemas"]["Permission"];
export type BaseRole = components["schemas"]["BaseRole"];
export type InviteStatus = components["schemas"]["InviteStatus"];
export type UserProfile = components["schemas"]["UserProfile"];
export type ContentNode = components["schemas"]["ContentNode"];
export type ContentNodeInput = components["schemas"]["ContentNodeInput"];
export type ContentMark = components["schemas"]["ContentMark"];
export type ContentMarkInput = components["schemas"]["ContentMarkInput"];
export type EntryVersion = components["schemas"]["EntryVersion"];
export type EntryVersionSummary = components["schemas"]["EntryVersionSummary"];
export type VersionReason = components["schemas"]["VersionReason"];
export type CollectionSchema = components["schemas"]["CollectionSchema"];
export type LocalCollectionSchema = components["schemas"]["LocalCollectionSchema"];
export type EffectiveCollectionSchema = components["schemas"]["EffectiveCollectionSchema"];
export type SchemaVersion = components["schemas"]["SchemaVersion"];
export type SchemaVersionSummary = components["schemas"]["SchemaVersionSummary"];
export type SchemaApplicationResult = components["schemas"]["SchemaApplicationResult"];
export type SchemaMigration = components["schemas"]["SchemaMigration"];
export type SchemaMigrationStatus = components["schemas"]["SchemaMigrationStatus"];
export type SchemaMigrationContentLossEntry =
  components["schemas"]["SchemaMigrationContentLossEntry"];
export type SchemaDefinition = components["schemas"]["SchemaDefinition"];
export type SchemaDraftDefinition = components["schemas"]["SchemaDraftDefinition"];
export type SchemaField = components["schemas"]["SchemaField"];
export type SchemaProperty = components["schemas"]["SchemaProperty"];
export type SchemaPropertyValue = components["schemas"]["SchemaPropertyValue"];
export type SchemaFragment = components["schemas"]["SchemaFragment"];
export type SchemaBlockType = components["schemas"]["SchemaBlockType"];
export type ResolvedSchemaDefinition = components["schemas"]["ResolvedSchemaDefinition"];
export type ResolvedSchemaField = components["schemas"]["ResolvedSchemaField"];
export type SchemaFieldSource = components["schemas"]["SchemaFieldSource"];
export type PublishingChannelCode = components["schemas"]["PublishingChannelCode"];
export type Entry = components["schemas"]["Entry"];
export type EntryFragment = components["schemas"]["EntryFragment"];
export type EntryProperty = components["schemas"]["EntryProperty"];
export type EntryPropertyKind = components["schemas"]["EntryPropertyKind"];
export type EntryPropertyValue = components["schemas"]["EntryPropertyValue"];
export type Pagination = components["schemas"]["Pagination"];
export type Asset = components["schemas"]["Asset"];
export type AssetAnalysis = components["schemas"]["AssetAnalysis"];
export type AssetAnalysisStatus = components["schemas"]["AssetAnalysisStatus"];
export type AssetStatus = components["schemas"]["AssetStatus"];
export type AssetFile = components["schemas"]["AssetFile"];
export type AssetFileFormat = components["schemas"]["AssetFileFormat"];
export type AssetVariant = components["schemas"]["AssetVariant"];
export type AssetSearchResult = components["schemas"]["AssetSearchResult"];
export type AssetUploadRegistration = components["schemas"]["AssetUploadRegistration"];
export type Membership = components["schemas"]["Membership"];
export type Invite = components["schemas"]["Invite"];
export type MembershipInviteResult = components["schemas"]["MembershipInviteResult"];
export type InviteDeliveryResult = components["schemas"]["InviteDeliveryResult"];
export type PublishedContent = components["schemas"]["PublishedContent"];
export type PublishedAsset = components["schemas"]["PublishedAsset"];
export type PublishedEntry = components["schemas"]["PublishedEntry"];
export type PublishedVersion = components["schemas"]["PublishedVersion"];
export type PublishedCollection = components["schemas"]["PublishedCollection"];
export type PublishedTree = components["schemas"]["PublishedTree"];
export type PublishingChannel = components["schemas"]["PublishingChannel"];
export type PublishingChannelListItem = components["schemas"]["PublishingChannelListItem"];
export type EntryPublication = components["schemas"]["EntryPublication"];
export type EntryPublicationChannel = components["schemas"]["EntryPublicationChannel"];
export type ChannelContent = components["schemas"]["ChannelContent"];
export type ChannelContentEntry = components["schemas"]["ChannelContentEntry"];
export type ChannelContentCollection = components["schemas"]["ChannelContentCollection"];
export type ChannelContentStatus = components["schemas"]["ChannelContentStatus"];
export type PublishEntryTarget = components["schemas"]["PublishEntryTarget"];
export type RevertPublishingChangesResult = components["schemas"]["RevertPublishingChangesResult"];
export type PublishedEntriesResult = components["schemas"]["PublishedEntriesResult"];
export type UnpublishedEntriesResult = components["schemas"]["UnpublishedEntriesResult"];
export type PropertyFilter = components["schemas"]["PropertyFilter"];
export type TextPropertyFilter = components["schemas"]["TextPropertyFilter"];
export type NumberPropertyFilter = components["schemas"]["NumberPropertyFilter"];
export type BooleanPropertyFilter = components["schemas"]["BooleanPropertyFilter"];
export type DatePropertyFilter = components["schemas"]["DatePropertyFilter"];
export type ComparisonOperator = components["schemas"]["ComparisonOperator"];
export type SearchPropertyValue = components["schemas"]["SearchPropertyValue"];
export type PublishedSearchResult = components["schemas"]["PublishedSearchResult"];
export type SearchResult = components["schemas"]["SearchResult"];
export type SearchResults = components["schemas"]["SearchResults"];
export type $defs = Record<string, never>;
export interface operations {
  "assets.search": {
    parameters: {
      query?: {
        /** @example mountains */
        query?: string;
        checksum?: string;
        semantic?: boolean;
        /** @example 10 */
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          "Cache-Control": "private, no-store";
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AssetSearchResult"][];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "assets.importURL": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "assetID": "ast_example",
         *       "entryID": "ent_example",
         *       "url": "https://example.com/image.png",
         *       "checkDuplicates": true
         *     }
         */
        "application/json": {
          assetID: string;
          entryID: string;
          /** Format: uri */
          url: string;
          /** @default false */
          checkDuplicates?: boolean;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          "Cache-Control": "private, no-store";
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                assetID: string;
              }
            | {
                duplicate: components["schemas"]["AssetSearchResult"];
              };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["AssetValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["AssetStorageErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["AssetConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "assets.attach": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ast_example */
        assetID: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "entryID": "ent_example"
         *     }
         */
        "application/json": {
          entryID: string;
        };
      };
    };
    responses: {
      /** @description OK */
      204: {
        headers: {
          "Cache-Control": "private, no-store";
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["AssetValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["AssetStorageErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["AssetConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "assets.register": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "assetID": "ast_example",
         *       "entryID": "ent_example",
         *       "filename": "image.png",
         *       "byteSize": 1024,
         *       "checksum": "0000000000000000000000000000000000000000000000000000000000000000"
         *     }
         */
        "application/json": {
          assetID: string;
          entryID: string;
          filename: string;
          byteSize: number;
          /** @description SHA-256 of the file bytes, verified by the backend and worker */
          checksum: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          "Cache-Control": "private, no-store";
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AssetUploadRegistration"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["AssetValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["AssetStorageErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["AssetConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "assets.upload": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ast_example */
        assetID: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "file": "<binary file>"
         *     }
         */
        "application/json": {
          file: Blob;
        };
        /**
         * @example {
         *       "file": "<binary file>"
         *     }
         */
        "multipart/form-data": {
          file: Blob;
        };
      };
    };
    responses: {
      /** @description OK */
      204: {
        headers: {
          "Cache-Control": "private, no-store";
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["AssetValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["AssetStorageErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["AssetConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "assets.get": {
    parameters: {
      query?: {
        /** @example ent_example */
        entryID?: string;
      };
      header?: never;
      path: {
        /** @example ast_example */
        assetID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          "Cache-Control": "private, no-store";
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Asset"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "instance.get": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InstanceInfo"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "entries.create": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "name": "Getting started",
         *       "collectionID": "coll_example"
         *     }
         */
        "application/json": {
          /** @description ID of the entry */
          id?: string;
          /** @description Name of the entry */
          name?: string;
          /** @description ID of the collection this entry belongs to */
          collectionID?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EntrySummary"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default CONTENT_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "entries.bulkDelete": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "ids": [
         *         "ent_example"
         *       ]
         *     }
         */
        "application/json": {
          /** @description IDs of the entries to delete */
          ids: string[];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "entries.update": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ent_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "name": "Installation"
         *     }
         */
        "application/json": {
          /** @description New name of the entry */
          name?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default CONTENT_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "entries.delete": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ent_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "entries.get": {
    parameters: {
      query?: {
        /** @example ent_example */
        id?: string;
        path?: string;
        expectedSchemaHash?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Entry"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_MISMATCH";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_MISMATCH */
                message: string;
                data: components["schemas"]["ContentSchemaMismatchErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "entries.list": {
    parameters: {
      query?: {
        /** @example coll_example */
        collectionID?: string;
        collectionPath?: string;
        cursor?: string;
        /** @example 20 */
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            data: components["schemas"]["EntrySummary"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "collections.create": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "name": "Documentation",
         *       "parentID": "coll_example"
         *     }
         */
        "application/json": {
          /** @description ID of the collection */
          id?: string;
          /** @description Name of the collection */
          name?: string;
          /** @description ID of the parent collection, */
          parentID?: string;
          /** @description Whether to restrict access to the collection tree */
          restricted?: boolean;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Collection"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default CONTENT_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "collections.bulkDelete": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "ids": [
         *         "coll_example"
         *       ]
         *     }
         */
        "application/json": {
          /** @description IDs of the collections to delete */
          ids: string[];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "collections.update": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example coll_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "name": "Guides"
         *     }
         */
        "application/json": {
          /** @description New name of the collection */
          name?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default CONTENT_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "collections.delete": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example coll_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "collections.list": {
    parameters: {
      query?: {
        /** @example coll_example */
        collectionID?: string;
        collectionPath?: string;
        cursor?: string;
        /** @example 20 */
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            data: components["schemas"]["Collection"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "content.listCollections": {
    parameters: {
      query?: {
        cursor?: string;
        /** @example 20 */
        limit?: number;
        collectionID?: string;
        collectionPath?: string;
        /** @example published */
        channel?: string;
        snapshotID?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            channel: components["schemas"]["PublishingChannelCode"];
            snapshotID: string;
            expiresAt: string | null;
            pagination: components["schemas"]["Pagination"];
            data: components["schemas"]["PublishedCollectionSummary"][];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "content.listEntries": {
    parameters: {
      query?: {
        cursor?: string;
        /** @example 20 */
        limit?: number;
        collectionID?: string;
        collectionPath?: string;
        /** @example published */
        channel?: string;
        snapshotID?: string;
        descendants?: boolean;
        includeContent?: boolean;
        filters?: components["schemas"]["PropertyFilter"][];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            channel: components["schemas"]["PublishingChannelCode"];
            snapshotID: string;
            expiresAt: string | null;
            pagination: components["schemas"]["Pagination"];
            data:
              | components["schemas"]["PublishedEntryContent"][]
              | components["schemas"]["PublishedEntrySummary"][];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "content.getSchema": {
    parameters: {
      query?: {
        /** @example ent_example */
        entryID?: string;
        path?: string;
        /** @example published */
        channel?: string;
        snapshotID?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SchemaRevision"] | null;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "content.getAsset": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ws_example */
        workspaceID: string;
        /** @example snp_example */
        snapshotID: string;
        /** @example ent_example */
        entryID: string;
        /** @example ast_example */
        assetID: string;
        /** @example display */
        variant: "thumbnail" | "display";
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          "Cache-Control": "private, no-store";
          "X-Content-Type-Options": "nosniff";
          "Content-Disposition": "inline";
          [name: string]: unknown;
        };
        content: {
          "*/*": Blob;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "content.get": {
    parameters: {
      query?: {
        /** @example ent_example */
        entryID?: string;
        path?: string;
        expectedSchemaHash?: string;
        /** @example published */
        channel?: string;
        snapshotID?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          "Cache-Control": string;
          "ETag": string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishedContent"];
        };
      };
      /** @description Not Modified */
      304: {
        headers: {
          "Cache-Control": string;
          "ETag": string;
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_MISMATCH";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_MISMATCH */
                message: string;
                data: components["schemas"]["ContentSchemaMismatchErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "content.getTree": {
    parameters: {
      query?: {
        /** @example coll_example */
        collectionID?: string;
        collectionPath?: string;
        /** @example published */
        channel?: string;
        snapshotID?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          "Cache-Control": string;
          "ETag": string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishedTree"];
        };
      };
      /** @description Not Modified */
      304: {
        headers: {
          "Cache-Control": string;
          "ETag": string;
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "roles.list": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Role"][];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "roles.create": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "name": "Editor",
         *       "permissions": [
         *         "content"
         *       ]
         *     }
         */
        "application/json": {
          /** @description Name of the role */
          name: string;
          /** @description Permissions to grant to the role */
          permissions: components["schemas"]["Permission"][];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Role"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "ROLE_NAME_INVALID";
                /** @constant */
                status: 400;
                /** @default ROLE_NAME_INVALID */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "ROLE_NAME_DUPLICATE";
                /** @constant */
                status: 409;
                /** @default ROLE_NAME_DUPLICATE */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "roles.update": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example rl_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "name": "Content editor"
         *     }
         */
        "application/json": {
          /** @description New name for the role */
          name?: string;
          /** @description New permissions for the role */
          permissions?: components["schemas"]["Permission"][];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "ROLE_NAME_INVALID";
                /** @constant */
                status: 400;
                /** @default ROLE_NAME_INVALID */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "ROLE_NAME_DUPLICATE";
                /** @constant */
                status: 409;
                /** @default ROLE_NAME_DUPLICATE */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "roles.delete": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example rl_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "search.current": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "query": "installation",
         *       "limit": 10
         *     }
         */
        "application/json": {
          query: string;
          collectionID?: string;
          /** @description Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK. */
          collectionPath?: string;
          /** @default [] */
          filters?: components["schemas"]["PropertyFilter"][];
          /** @default 20 */
          limit?: number;
          /**
           * @description Whether to combine keyword and vector search
           * @default false
           */
          semantic?: boolean;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SearchResults"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "search.published": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "query": "installation",
         *       "channel": "published",
         *       "limit": 10
         *     }
         */
        "application/json": {
          query: string;
          collectionID?: string;
          /** @description Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK. */
          collectionPath?: string;
          /** @default [] */
          filters?: components["schemas"]["PropertyFilter"][];
          /** @default 20 */
          limit?: number;
          /**
           * @description Whether to combine keyword and vector search
           * @default false
           */
          semantic?: boolean;
          /** @description Publishing channel to search */
          channel: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            results: components["schemas"]["PublishedSearchResult"][];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "search.askCurrent": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "question": "How do I install Andesine?"
         *     }
         */
        "application/json": {
          question: string;
          collectionID?: string;
          /** @description Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK. */
          collectionPath?: string;
          /** @default [] */
          filters?: components["schemas"]["PropertyFilter"][];
          /** @default [] */
          history?: components["schemas"]["AnswerHistoryMessage"][];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Answer"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "search.askPublished": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "question": "How do I install Andesine?",
         *       "channel": "published"
         *     }
         */
        "application/json": {
          question: string;
          collectionID?: string;
          /** @description Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK. */
          collectionPath?: string;
          /** @default [] */
          filters?: components["schemas"]["PropertyFilter"][];
          /** @default [] */
          history?: components["schemas"]["AnswerHistoryMessage"][];
          /** @description Publishing channel to search */
          channel: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishedAnswer"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "search.askCurrentStream": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": {
          question: string;
          collectionID?: string;
          /** @description Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK. */
          collectionPath?: string;
          /** @default [] */
          filters?: components["schemas"]["PropertyFilter"][];
          /** @default [] */
          history?: components["schemas"]["AnswerHistoryMessage"][];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "text/event-stream":
            | {
                /** @constant */
                event: "message";
                data: components["schemas"]["AnswerEvent"];
                id?: string;
                retry?: number;
              }
            | {
                /** @constant */
                event: "done";
                data?: unknown;
                id?: string;
                retry?: number;
              }
            | {
                /** @constant */
                event: "error";
                data?: unknown;
                id?: string;
                retry?: number;
              };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "search.askPublishedStream": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": {
          question: string;
          collectionID?: string;
          /** @description Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK. */
          collectionPath?: string;
          /** @default [] */
          filters?: components["schemas"]["PropertyFilter"][];
          /** @default [] */
          history?: components["schemas"]["AnswerHistoryMessage"][];
          /** @description Publishing channel to search */
          channel: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "text/event-stream":
            | {
                /** @constant */
                event: "message";
                data: components["schemas"]["PublishedAnswerEvent"];
                id?: string;
                retry?: number;
              }
            | {
                /** @constant */
                event: "done";
                data?: unknown;
                id?: string;
                retry?: number;
              }
            | {
                /** @constant */
                event: "error";
                data?: unknown;
                id?: string;
                retry?: number;
              };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemas.create": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example coll_example */
        collectionID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["LocalCollectionSchema"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemas.delete": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example sch_example */
        schemaID: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "confirmedDataLoss": false
         *     }
         */
        "application/json": {
          /**
           * @description Confirmation that an inherited-schema migration can remove entry content
           * @default false
           */
          confirmedDataLoss?: boolean;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            migrationID: string | null;
            affectedCollectionIDs: string[];
            totalEntries: number;
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemas.getRevision": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example schr_example */
        revisionID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SchemaRevision"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemas.get": {
    parameters: {
      query?: {
        /** @example coll_example */
        collectionID?: string;
        collectionPath?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CollectionSchema"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemas.apply": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example sch_example */
        schemaID: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "confirmedDataLoss": true,
         *       "name": "Reviewed schema"
         *     }
         */
        "application/json": {
          /**
           * @description Confirmation that the migration can remove entry content
           * @constant
           */
          confirmedDataLoss: true;
          /** @description Optional version name */
          name?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SchemaApplicationResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemaMigrations.listContentLossEntries": {
    parameters: {
      query?: {
        cursor?: string;
        /** @example 20 */
        limit?: number;
      };
      header?: never;
      path: {
        /** @example smg_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            data: components["schemas"]["SchemaMigrationContentLossEntry"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemaMigrations.getActive": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example coll_example */
        collectionID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SchemaMigration"] | null;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemaMigrations.get": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example smg_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SchemaMigration"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemaVersions.list": {
    parameters: {
      query?: {
        cursor?: string;
        /** @example 20 */
        limit?: number;
      };
      header?: never;
      path: {
        /** @example sch_example */
        schemaID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            data: components["schemas"]["SchemaVersionSummary"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemaVersions.get": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example schv_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SchemaVersion"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemaVersions.update": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example schv_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "name": "Reviewed schema"
         *     }
         */
        "application/json": {
          /** @description New version name, or null to remove it */
          name: string | null;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "schemaVersions.revert": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example schv_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "confirmedDataLoss": true
         *     }
         */
        "application/json": {
          /**
           * @description Confirmation that the migration can remove entry content
           * @constant
           */
          confirmedDataLoss: true;
          /** @description Optional version name */
          name?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SchemaApplicationResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "memberships.list": {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            data: components["schemas"]["Membership"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "memberships.invite": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "email": "editor@example.com",
         *       "roleID": "rl_example"
         *     }
         */
        "application/json": {
          /**
           * Format: email
           * @description Email address of the user to invite
           */
          email: string;
          /** @description ID of the role to assign */
          roleID: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["MembershipInviteResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "MEMBERSHIP_ALREADY_EXISTS";
                /** @constant */
                status: 409;
                /** @default MEMBERSHIP_ALREADY_EXISTS */
                message: string;
                data: components["schemas"]["MembershipExistsErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INVITE_ALREADY_PENDING";
                /** @constant */
                status: 409;
                /** @default INVITE_ALREADY_PENDING */
                message: string;
                data: components["schemas"]["InvitePendingErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "memberships.remove": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ms_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "memberships.update": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ms_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "roleID": "rl_example"
         *     }
         */
        "application/json": {
          /** @description New role ID */
          roleID: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "memberships.listInvites": {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            data: components["schemas"]["Invite"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "memberships.resendInvite": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example inv_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InviteDeliveryResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "memberships.revokeInvite": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example inv_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.setCollection": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example coll_example */
        collectionID: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "enabled": true,
         *       "publish": false
         *     }
         */
        "application/json": {
          /** @description Optional snapshot checks for supplied channels before changing collection publishing. Omitted channels are not checked. */
          expectedSnapshots?: {
            [key: string]: string;
          };
          /** @description Enable publishing, or disable and unpublish the collection tree from all channels */
          enabled: boolean;
          /** @description Whether to publish latest entry versions when enabling publishing */
          publish?: boolean;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishedEntriesResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.publishCollection": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example coll_example */
        collectionID: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishedEntriesResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.unpublishCollection": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example coll_example */
        collectionID: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UnpublishedEntriesResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.bulkSetCollections": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "ids": [
         *         "coll_example"
         *       ],
         *       "enabled": true,
         *       "publish": false
         *     }
         */
        "application/json": {
          /** @description IDs of the collections to configure */
          ids: string[];
          /** @description Optional snapshot checks for supplied channels before changing collection publishing. Omitted channels are not checked. */
          expectedSnapshots?: {
            [key: string]: string;
          };
          /** @description Enable publishing, or disable and unpublish the collection trees from all channels */
          enabled: boolean;
          /** @description Whether to publish latest entry versions when enabling publishing */
          publish?: boolean;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishedEntriesResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.bulkPublishCollections": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "ids": [
         *         "coll_example"
         *       ],
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
          /** @description IDs of the collection trees to publish */
          ids: string[];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishedEntriesResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.bulkUnpublishCollections": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "ids": [
         *         "coll_example"
         *       ],
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
          /** @description IDs of the collection trees to unpublish */
          ids: string[];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UnpublishedEntriesResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.publishEntry": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ent_example */
        entryID: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
          /** @description Existing version to publish */
          versionID?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.unpublishEntry": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ent_example */
        entryID: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "channel": "published",
         *       "versionID": "ver_example"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
          /** @description Version expected to be assigned */
          versionID?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.bulkPublishEntries": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "entries": [
         *         {
         *           "entryID": "ent_example"
         *         }
         *       ],
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
          /** @description Entries and versions to publish */
          entries: components["schemas"]["PublishEntryTarget"][];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.bulkUnpublishEntries": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "ids": [
         *         "ent_example"
         *       ],
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Reject the mutation if the channel no longer points to this reviewed snapshot */
          expectedSnapshotID?: string;
          /** @description IDs of the entries to unpublish */
          ids: string[];
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.revertChanges": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "collectionID": "coll_example",
         *       "snapshotID": "snp_example",
         *       "entryIDs": [
         *         "ent_example"
         *       ],
         *       "channel": "published"
         *     }
         */
        "application/json": {
          /**
           * @description Publishing channel, defaults to published
           * @default published
           */
          channel?: string;
          /** @description Whether to revert all pending changes */
          all?: boolean;
          /** @description Publishing root collection */
          collectionID: string;
          /** @description Collections whose changes to revert */
          collectionIDs?: string[];
          /** @description Entries whose changes to revert */
          entryIDs?: string[];
          /** @description Snapshot used to review the changes */
          snapshotID: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RevertPublishingChangesResult"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default CONTENT_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.getEntryVersion": {
    parameters: {
      query?: {
        /** @example published */
        channel?: string;
        expectedSchemaHash?: string;
        snapshotID?: string;
      };
      header?: never;
      path: {
        /** @example ent_example */
        entryID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EntryVersion"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_MISMATCH";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_MISMATCH */
                message: string;
                data: components["schemas"]["ContentSchemaMismatchErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.listEntryPublications": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ent_example */
        entryID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EntryPublication"][];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.listChannels": {
    parameters: {
      query?: {
        /** @example true */
        includeAssignmentCount?: boolean;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishingChannelListItem"][];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.createChannel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "name": "Preview"
         *     }
         */
        "application/json": {
          /** @description Publishing channel label */
          name: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PublishingChannel"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.getChannelContent": {
    parameters: {
      query: {
        /** @example coll_example */
        collectionID: string;
      };
      header?: never;
      path: {
        /** @example published */
        channel: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ChannelContent"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "publishing.deleteChannel": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example preview */
        code: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /** @example {} */
        "application/json": {
          /** @description Reject deletion if the channel snapshot changed */
          expectedSnapshotID?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default PUBLISHING_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "PUBLISHING_SNAPSHOT_CHANGED";
                /** @constant */
                status: 409;
                /** @default Publishing snapshot changed */
                message: string;
                data: components["schemas"]["PublishingSnapshotErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "versions.list": {
    parameters: {
      query?: {
        cursor?: string;
        /** @example 20 */
        limit?: number;
      };
      header?: never;
      path: {
        /** @example ent_example */
        entryID: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            data: components["schemas"]["EntryVersionSummary"][];
            pagination: components["schemas"]["Pagination"];
          };
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "versions.create": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ent_example */
        entryID: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        /**
         * @example {
         *       "name": "Before release"
         *     }
         */
        "application/json": {
          /** @description Optional version name */
          name?: string;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EntryVersion"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "versions.get": {
    parameters: {
      query?: {
        expectedSchemaHash?: string;
      };
      header?: never;
      path: {
        /** @example ver_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EntryVersion"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_MISMATCH";
                /** @constant */
                status: 409;
                /** @default CONTENT_SCHEMA_MISMATCH */
                message: string;
                data: components["schemas"]["ContentSchemaMismatchErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "versions.update": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ver_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        /**
         * @example {
         *       "name": "Release candidate"
         *     }
         */
        "application/json": {
          /** @description New version name, or null to remove it */
          name: string | null;
        };
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": never;
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
  "versions.revert": {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @example ver_example */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EntryVersion"];
        };
      };
      /** @description 400 */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "BAD_REQUEST";
                /** @constant */
                status: 400;
                /** @default Bad Request */
                message: string;
                data?: components["schemas"]["ValidationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 401 */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "UNAUTHORIZED";
                /** @constant */
                status: 401;
                /** @default Unauthorized */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 403 */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "FORBIDDEN";
                /** @constant */
                status: 403;
                /** @default Forbidden */
                message: string;
                data?: components["schemas"]["ForbiddenErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 404 */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "NOT_FOUND";
                /** @constant */
                status: 404;
                /** @default Not Found */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 409 */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONFLICT";
                /** @constant */
                status: 409;
                /** @default Conflict */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_NAME_CONFLICT";
                /** @constant */
                status: 409;
                /** @default CONTENT_NAME_CONFLICT */
                message: string;
                data: components["schemas"]["ContentNameConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_FIELD_KEY_CONFLICT";
                /** @constant */
                status: 409;
                /** @default SCHEMA_FIELD_KEY_CONFLICT */
                message: string;
                data: components["schemas"]["SchemaFieldKeyConflictErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SCHEMA_MIGRATION_IN_PROGRESS";
                /** @constant */
                status: 409;
                /** @default A schema migration is in progress for this collection */
                message: string;
                data: components["schemas"]["SchemaMigrationErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 429 */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "TOO_MANY_REQUESTS";
                /** @constant */
                status: 429;
                /** @default Too Many Requests */
                message: string;
                data?: components["schemas"]["RateLimitErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 500 */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "INTERNAL_SERVER_ERROR";
                /** @constant */
                status: 500;
                /** @default Internal Server Error */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "CONTENT_SCHEMA_INVALID";
                /** @constant */
                status: 500;
                /** @default CONTENT_SCHEMA_INVALID */
                message: string;
                data: components["schemas"]["ContentSchemaInvalidErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
      /** @description 503 */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                /** @constant */
                defined: true;
                /** @constant */
                code: "SERVICE_UNAVAILABLE";
                /** @constant */
                status: 503;
                /** @default Service Unavailable */
                message: string;
                data?: components["schemas"]["ErrorData"];
              }
            | {
                /** @constant */
                defined: false;
                code: string;
                status: number;
                message: string;
                data?: unknown;
              };
        };
      };
    };
  };
}
