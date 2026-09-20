# API contracts

This directory defines HTTP routes, input and output schemas, and procedure
metadata with `@orpc/contract`. Each resource has one contract. Both public HTTP
and internal RPC procedures are included so that server handlers use the same
definitions. The OpenAPI generator filters the public API by authorization
metadata and includes anonymous published-asset delivery.

Contract imports must not read backend environment variables or initialize
services. Reuse schemas from modules that are safe to import on their own. Avoid
shared export files that also export database access, queues, or service methods.
Database table and enum declarations are safe to import; database clients are not.

`createAPIContract()` accepts the instance's upload-size limit. Without an option,
it uses the default from the asset configuration schema. The exporter uses this
default. `router/implement.ts` supplies the backend's configured limit and exports
the contract instance used by both handlers and the server's OpenAPI document.

To change an endpoint:

1. Change its route, schemas, or metadata in the resource contract.
2. Change its handler in the matching `router` module. Use the corresponding
   procedure from `api`, and assemble the result with its `.router()` method.
3. For authenticated procedures, select the procedure from
   `handlers.use(authorized)` before attaching `.handler()`. This keeps
   authorization before input validation. Metadata describes the required
   permissions; the middleware enforces them.
4. Run backend type checking, export the OpenAPI document, and regenerate the SDK.

```sh
pnpm --filter @andesine/backend typecheck
pnpm --filter @andesine/backend openapi:export
pnpm --filter @andesine/sdk generate
```

The export script imports only contracts and calls `OpenAPIGenerator.generate()`
through the shared `generateOpenAPI()` helper. It does not bundle or rewrite
backend source code.

## Reusable schemas

`schemas/` contains reusable Zod schemas extracted from the resource contracts:

- `entries.ts`: full entries, fragments, properties, property kinds and values.
- `assets.ts`: asset details, analysis, files, statuses, formats, variants, search
  results, and upload registration results.
- `content.ts`: published content, assets, tree entries, version references, and
  recursive collections, plus the HTTP cache response schemas.
- `publishing.ts`: channels, publications, channel content and status, publishing
  targets, and operation results.
- `memberships.ts`: member and invite details, and invitation delivery results.
- `search.ts`: property filters, property values, search inputs and results. It
  also holds the internal question and answer schemas used by the same resource.
- `pagination.ts`: shared cursor pagination metadata.

Reuse existing schemas in their current modules: collection and role schemas in
`db`, version and migration schemas in `lib/data`, content nodes and marks in
`lib/content/validation`, and schema fields and definitions in `lib/schema`.
These definitions must remain the same objects used by the contracts; do not
copy their shapes into SDK types.

`schemas/public.ts` registers public schemas in oRPC's `commonSchemas`. Each key
becomes an OpenAPI component name and a generated SDK type export, both directly
and under `Andesine`. Choose clear PascalCase names, and register the existing
schema object with the correct `input` or `output` strategy. Input schemas retain
optional fields with server defaults; output schemas describe returned data.
Content nodes and marks have separate input and output components.

Register only schemas intended for public API consumers. Keep session-only
schemas and HTTP response envelopes out of the registry. A new component needs
no manual SDK alias: export the spec and run SDK generation. The SDK also
generates aliases such as `EntriesCreateInput` and `EntriesGetOutput` from public
operation IDs. These aliases use the SDK's combined arguments and returned data.

## Operation documentation and errors

Each public route supplies `summary`, `description`, and `tags`. Describe defaults,
side effects, limits, and related operations where they help callers. Keep existing
operation IDs and paths stable unless the API itself must change.

Use `.meta({ example: { ... } })` for an example of the combined SDK input. The
OpenAPI helper places values in parameter and request-body examples and exports
`x-sdk-example` for SDK method documentation. Required API key permissions come
from authorization metadata. Example IDs are placeholders. For binary uploads,
`"<binary file>"` represents file bytes; SDK documentation renders it as a Blob.

`errors.ts` defines common and domain error maps with `.errors()`. Attach domain
maps to procedures that can raise those errors. Throw `ORPCError` with the same
code, status, and matching data. oRPC validates data and marks declared errors with
`defined: true`. Undeclared errors remain possible and must still be handled.

`schemas/errors.ts` defines public error data, including optional `hints`. Use
short, maintained advice based on known state. Do not expose internal exceptions
or suggest an automatic repeat of a write. Stable codes and structured fields are
for program logic; hint wording is not stable. Keep IDs in their public short form.

Generate OpenAPI and the SDK after changing error maps. Named error data types and
operation error aliases are generated with the other public types. No separate
manual SDK error-code list is required.

Asset operations extend common error data with upload details, asset status, and
storage usage. Keep these fields on the applicable operation error maps so oRPC
does not remove them during validation. New rate limits should include
`retryAfterSeconds` only when the delay is known; the authorization middleware
copies it to `Retry-After`. Do not invent a delay for concurrency limits.

## Bounded reads and publishing checks

`lib/api/limits.ts` defines shared page, bulk, and search limits. Keep contract
validation and the values returned by `instance.get` in sync. Instance limits use
the configured upload limit and the effective workspace storage plan.

Cursor lists return `{ data, pagination }`. Members, invitations, and migration
content-loss entries use this format. Migration status has no embedded entry list.
Published entry and collection lists add `channel`, `snapshotID`, and `expiresAt`;
continuation requests must use the same snapshot. Filter access before the SQL
limit, and order cursor queries by the same ID used by the cursor.

Publishing writes accept `expectedSnapshotID`. Collection publishing settings use
an optional `expectedSnapshots` map because they can affect several channels. Check
supplied expectations inside the mutation transaction with
`assertPublishingSnapshot`, which holds a channel lock through commit. Keep the
existing internal snapshot checks too. A stale expectation uses the declared
`PUBLISHING_SNAPSHOT_CHANGED` error. These checks do not cover draft revisions and
do not provide idempotency.
