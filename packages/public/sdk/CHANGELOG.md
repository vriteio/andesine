# Changelog

## Unreleased

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
