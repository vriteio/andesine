# Changelog

## 0.2.0

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
