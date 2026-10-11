# Changelog

## 0.7.0

- `auth.getIdentity` returns `client` (ID and registered name) for OAuth access tokens.
- Webhook events have an `actor`: the member, API key, extension, or app (OAuth client ID and
  registered name, with the member) that made the change, or `null` for changes by Andesine.
- OAuth for MCP clients: the authorization server supports the authorization code flow with
  PKCE and dynamic client registration, with the scopes `andesine:read` and `andesine:write`.
  `auth.getIdentity` returns `scopes` and `workspaceID` for such tokens.
- `auth.getIdentity` returns the `permissions` of an API key, and `instance.get` returns
  `appURL`, the web app URL (entries open at `{appURL}/{workspaceID}/{entryID}`).
- `versions.create` takes an optional `document`: ProseMirror JSON checked against the editor
  and the entry's collection schema. The version has the new reason `import`, and the
  current content does not change.
- `entries.get` returns `hash`, the hash of the current content, comparable to version hashes.
- Add `entries.move` and `collections.move` (API key permissions `entries` and
  `collections`). Without `order`, a moved entry keeps its position in the same collection
  and goes last in a new one.
- `entries.update` replaces the content with `document` and `expectedHash`, the hash of the
  content it replaces. Only the changed blocks change, so live edits elsewhere are kept. A
  different current hash returns the new error `CONTENT_HASH_MISMATCH` (409) with the current
  `hash`. Current content without a version is first saved as an `auto` version, and `version`
  also saves the new content as a `manual` version. Use `name` or `document`, not both. The
  result is `{ hash, version }`; before, it was empty.
- `entries.create` takes an optional `document` in place of `name`; its title sets the name.
- MDX content: `entries.get`, `versions.get`, and `content.get` take `contentFormat: "mdx"`
  and then also return the content as MDX in `mdx`: the title as H1, properties as
  `<Property name value />` elements in their position, fragments as `<Fragment name>`
  elements, and images as `asset:<assetID>` references (delivery URLs in published content).
  `entries.create`, `entries.update`, and `versions.create` take `mdx` in place of `document`;
  frontmatter properties are also read. Fields match by name or key. Node IDs and attributes
  that MDX doesn't hold are kept from the current content. Invalid MDX returns the new error
  `CONTENT_FORMAT_INVALID` (400) with the line and column.
- `Fragment` and `Property` are reserved element names; content writes with them return
  `CONTENT_SCHEMA_INVALID`.
- `entries.update` takes `operations`, applied in order with all or none applied:
  `replaceText` (`find` must occur once in one block's MDX), `replaceBlock`, `insertBlocks`
  (`before`, `after`, or `position` with an optional `fragment`), `deleteBlocks`, and `setField`
  (a property value, or MDX for a fragment). Anchors come from `entries.get` with
  `contentFormat: "blocks"`, which returns the blocks with IDs, fragment keys, and MDX.
  `expectedHash` is optional with operations; `name` can be combined with them. A missing or
  ambiguous anchor returns the new error `CONTENT_OPERATION_INVALID` (409) with the operation
  `index` and `reason`.
- Internal links: link marks can point to entries with `entry:<entryID>`, and an optional
  `#anchor`. Content writes also accept `entry:<path>` (a path or slug path) and store the entry
  ID; a link to a missing entry returns the new error `CONTENT_LINK_INVALID` (409).
  `entries.get` and `versions.get` return `references`: the path, slug path, title, and
  collection of each linked entry, or `available: false` for deleted and unreadable entries.
  MDX and blocks show links by slug path. Published content resolves links to the entry's slug
  path in the snapshot, and removes links to entries that aren't published (the text stays).
- Images follow content: content writes attach the `asset:<assetID>` images they newly
  reference (the caller must be able to read each image and update the entry), so
  `assets.attach` is no longer part of the public API. `entries.update` and `versions.create`
  also import image URLs in MDX and wait until the images are ready; an image that fails or is
  still processing returns the new error `CONTENT_IMAGE_UNAVAILABLE` (409). `entries.create`
  accepts only `asset:` images. To remove an image, remove it from the content.
- `entries.create` takes `path`: a full name path. Missing parent collections are created with
  exact names; a name already used at the path returns `CONTENT_NAME_CONFLICT`.
- Target collections by path: `entries.create` and `entries.move` take `collectionPath` or
  `collectionSlugPath` in place of `collectionID`, `collections.create` takes `parentPath` or
  `parentSlugPath`, `collections.move` takes `newParentPath` or `newParentSlugPath` (`/` is the
  top level), and `publishing.getChannelContent` takes `collectionPath` or `collectionSlugPath`.
  These select existing collections only.
- Preconditions: `expectedName` on `entries.update` and `collections.update`,
  `expectedCollectionID` on `entries.move`, and `expectedParentID` on `collections.move`. A
  different current value returns the new error `CONTENT_PRECONDITION_FAILED` (409) with the
  current value.
- `Idempotency-Key` header on `entries.create`, `entries.update`, and `versions.create`: a
  repeated request returns the first result for 24 hours (with `Idempotent-Replayed: true`).
  The same key with a different body returns `IDEMPOTENCY_KEY_REUSED` (422), and a repeat while
  the first request runs returns `IDEMPOTENCY_KEY_IN_PROGRESS` (409). The SDK sends a generated
  key for these operations unless `headers` has one, and `retries` now also applies to them, including a retry that
  arrives while the first attempt still runs (`IDEMPOTENCY_KEY_IN_PROGRESS`, with
  `Retry-After: 1`).
- Add `entries.bulkUpdate`: the items of `entries.update` for many entries in one call (a name
  without content is written as the title). All items are checked before any content changes,
  and all or none apply; errors name the failing item. Supports `Idempotency-Key`.
- Add `entries.bulkMove`: the items of `entries.move` in one call, all or none. Moves that need a
  schema migration aren't supported; use `entries.move` for them.
- Add `publishing.updateChannel`: renames a channel; its code doesn't change.
- `entries.create` takes `fields`: property values and fragment MDX by field name or key.
- `entries.get` returns the content of a document that is open in the editor, including edits
  that aren't saved yet, so its `hash` matches what content writes compare against.

## 0.6.0

- No changes; versioned with the other public Andesine packages.

## 0.5.0

- Add the extension API operations `extensions.getSelf`,
  `extensions.verifySession`, `extensions.listInstallations`,
  `extensions.getSelfConfiguration`, and the storage operations
  `extensions.getSelfStorageEntry`, `extensions.setSelfStorageEntry`,
  `extensions.deleteSelfStorageEntry`, and `extensions.listSelfStorageEntries`. They use an
  extension JWT (`extensionToken` security scheme), not an API key.
- Add `@andesine/sdk/extensions` for extension backends: `createExtensionBackend`
  signs and caches extension JWTs (EdDSA or ES256 private JWK with `kid`),
  `createClient(instance, extensionID?)` returns API clients for an installation
  or app-level calls, and `verifySession(headers)` verifies a frontend session
  token. `receive(body)` handles an extension webhook notification and
  fetches its delivery (`extensions.getSelfDelivery`). Only the configured
  `trustedInstances` are accepted.
- Add the `extensions` role permission (manage workspace extensions) to the role types.

## 0.4.0

- Document the limits: per-minute rate limits, the monthly API call and AI credit
  meters, the Pro spending limit, the `X-RateLimit-*`, `X-API-Usage*`, and
  `X-AI-Credits*` headers, and the new `limit` field of `TOO_MANY_REQUESTS` error
  data (`rate`, `api-calls`, `ai-credits`, or `spending`). `X-RateLimit-*` now
  describes the rate limit, not the monthly usage.

- Document publishable keys (`adn_pk_...`) for browser use: published content
  reads, search, and answers from the key's collections and origins, and server
  reads without an `Origin`, e.g. site builds.

## 0.3.0

- Add generated webhook methods for management (including bulk enable/disable and
  delete), delivery history, signed tests, and single or bulk replay, plus public
  webhook event types.
- Add the isolated `@andesine/sdk/webhooks` verifier with raw-body authentication,
  timestamp and schema checks, plus receiver and durable deduplication examples.

## 0.2.0

- Add derived `slugPath` selectors and responses, slug-based sibling uniqueness,
  slug-aware workspace maps, and slug URLs by default in `toContentURL`.

- Add type-only workspace maps through `createClient<Workspace>()`, with selector-aware
  content types, revision unions, optional entry/tree bindings, and typed content helpers.
- Add bulk current/published type metadata with effective schema revisions,
  optional entries/tree, consistent source reads, and stable fingerprints.
- Explicit OAuth access tokens without API-key environment fallback, plus credential identity and user workspace discovery.

## 0.1.0

- Initial public TypeScript client generated from the Andesine OpenAPI document.
- Generated public schema and operation types, with direct and `Andesine` imports.
- Configurable base URL, authentication, Fetch implementation, timeouts, and cancellation.
- Typed errors, full-response mode, snapshots, pagination, and optional read retries.
- Publishing snapshot preconditions, bounded bulk inputs, and authenticated instance limits.
- Paginated members, invitations, migration content-loss entries, and published content listings.
- Resumable item and page iterators with snapshot metadata available on pages.
- Recorded schema metadata and exact revision reads, expected schema hashes, and structured schema validation errors.
- Shared sibling names, creation suffixes, and typed name-conflict errors for rename and restore operations.
- ID-or-path reads, collection path scopes, canonical paths, and a virtual published root tree.
- Snapshot-based path resolution and typed publication name-conflict errors.
- Read selectors use query parameters on fixed GET routes; collection lists use `collectionID` or `collectionPath` instead of `ancestorID`.
- Published entry lists support property filters, descendant scopes, and optional full content with input-dependent response types.
- Nested query filters use indexed bracket encoding compatible with the API.
- `toStructuredContent` unwraps property values and fragment content while preserving metadata and empty values.
- Canonical search paths and heading anchors, with required snapshot and version metadata on published results.
- Public complete AI answers with explicit key permissions, typed sources and history, and instance capability flags.
- Typed SSE answer methods, cancellation through consumption, stream errors, and optional `streaming` response/reader helpers.
