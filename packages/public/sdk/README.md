# @andesine/sdk

MIT-licensed TypeScript client for the public Andesine HTTP API. ESM only. Requires
Node.js 22 or later, or a browser/worker runtime with Fetch, Blob, FormData, and
AbortSignal.any. Keep private API keys in server code.

## Use

```sh
npm install @andesine/sdk
```

```ts
import { createClient } from "@andesine/sdk";

const client = createClient({
  baseURL: "https://api.andesine.app",
  apiKey: process.env.ANDESINE_API_KEY
});

const entry = await client.entries.get({ id: "ent_123" });
const published = await client.content.get({
  entryID: entry.id,
  channel: "published"
});
```

`baseURL` is required. A trailing slash is optional; path prefixes are preserved.
Each client has its own configuration. You can supply `fetch` and default
`headers` for proxies, instrumentation, or other authentication arrangements.

Resource methods are generated from the checked-in OpenAPI document. They cover
assets, entries, collections, content delivery, roles, search, schemas, schema
migrations, schema versions, memberships, publishing, entry versions, and instance information. Internal
session-only operations are excluded. Published asset delivery does not require
an API key.

Methods accept one object containing path, query, and body fields. Operations
without required fields can be called without arguments. Date/time values remain
JSON strings. File inputs and binary outputs use `Blob`.

```ts
await client.assets.upload({ assetID: "ast_123", file: new Blob([bytes]) });
const image = await client.assets.get({ assetID: "ast_123", entryID: entry.id });
```

The client does not add a content-save endpoint. Use converters to produce JSON;
storage remains a separate responsibility.

## Errors and responses

Methods return data directly. HTTP failures throw `AndesineAPIError`, with
`status`, `code`, `message`, `data`, `defined`, `hints`, and the Fetch `response`. Network failures and
cancellation retain their native errors.

```ts
import { AndesineAPIError } from "@andesine/sdk";

try {
  await client.entries.update({ id: "ent_123", name: "Installation" });
} catch (error) {
  if (error instanceof AndesineAPIError) {
    console.error(error.status, error.code, error.message, error.hints);

    if (error.is("SCHEMA_MIGRATION_IN_PROGRESS")) {
      // data is typed for this code.
      console.log(error.data.migrationID);
    }

    if (error.is("TOO_MANY_REQUESTS")) {
      console.log(error.data?.retryAfterSeconds);
    }
  }
}

const result = await client.content.get(
  { entryID: "ent_123" },
  { response: "full", headers: { "If-None-Match": cachedETag } }
);

if (result.notModified) {
  // Reuse the cached content.
} else {
  console.log(result.data, result.headers.get("ETag"));
}
```

Use full-response mode for conditional requests. A 304 response has
`notModified: true` and no data. A 304 in data mode causes a clear error because
the client does not store a response cache.

## Cancellation, timeouts, and retries

The default timeout is 30 seconds. Set `timeout: 0` to disable it. Timeouts include
request execution, response reading, and retry delays. Supply `signal` per call
for cancellation.

Retries are **disabled by default**. Set `retries: 2` on the client or a call to
allow up to two retries of GET requests. Reads retry network `TypeError` failures
and HTTP 429, 500, 502, 503, and 504. They respect `Retry-After`, otherwise use
increasing delays with jitter. Writes are never retried automatically.

```ts
await client.entries.get(
  { id: "ent_123" },
  { signal: controller.signal, timeout: 10_000, retries: 2 }
);
```

## Snapshots and pagination

Pin related content reads to the snapshot returned by the first read:

```ts
const tree = await client.content.getTree({ collectionID: "col_123" });
const content = client.atSnapshot(tree.snapshotID);
const entry = await content.get({ entryID: "ent_123" });
```

`atSnapshot()` returns content resource methods. It rejects a conflicting channel
or snapshot selector. It does not pin unrelated management operations. Snapshot
image URLs can expire; copying images for archival export is the caller's task.

```ts
import { paginate } from "@andesine/sdk";

for await (const entry of paginate((cursor) => client.entries.list({ cursor }))) {
  console.log(entry.name);
}
```

Cursor lists default to 50 items and accept at most 100. `memberships.list()` and
`memberships.listInvites()` return `{ data, pagination }`. Migration status no longer
includes `contentLossEntries`; use `schemaMigrations.listContentLossEntries()` for
that paginated list. Mutable management lists are not snapshots: concurrent edits
can change their contents between requests.

Use `paginatePages()` to keep page metadata and save a cursor after processing a
whole page. Both iterators accept `{ cursor }` to resume. Save the same filters with
your cursor. A missing or repeated continuation cursor causes an error.

Published listings also require the snapshot ID on later pages. The first page
selects a channel; later pages select that exact snapshot:

```ts
import { paginatePages } from "@andesine/sdk";

let snapshotID: string | undefined; // Restore this together with a saved cursor.
const savedCursor: string | undefined = undefined;

for await (const page of paginatePages(
  (cursor) =>
    client.content.listEntries({
      ...(snapshotID ? { snapshotID } : { channel: "published" }),
      cursor,
      limit: 100
    }),
  { cursor: savedCursor }
)) {
  snapshotID = page.snapshotID;
  // Process page.data, then save snapshotID and page.pagination.nextCursor.
  // A null nextCursor means the listing is complete.
}
```

`content.listCollections()` uses the same format. Both return flat records ordered
by ID, with parent/collection IDs for links. Entry summaries include a version ID and
hash. Use `includeContent: true` for full entry records, or fetch one entry with
`client.atSnapshot(snapshotID).get()`. Snapshot expiry
still applies. If a saved snapshot is unavailable, start a new listing from its
channel; do not combine the old cursor with a new snapshot.

### Filtered full-content lists

```ts
const page = await client.content.listEntries({
  collectionPath: "/Tutorials",
  descendants: true,
  includeContent: true,
  filters: [
    { kind: "text", key: "audience", values: ["beginner"] },
    { kind: "boolean", key: "enabled", value: true }
  ],
  limit: 50
});

for (const entry of page.data) {
  console.log(entry.path, entry.content, entry.properties, entry.schema);
}

if (page.pagination.nextCursor) {
  const next = await client.atSnapshot(page.snapshotID).listEntries({
    collectionPath: "/Tutorials",
    descendants: true,
    includeContent: true,
    filters: [
      { kind: "text", key: "audience", values: ["beginner"] },
      { kind: "boolean", key: "enabled", value: true }
    ],
    cursor: page.pagination.nextCursor,
    limit: 50
  });
}
```

`includeContent` defaults to false. A literal true gives full items; false or an
omitted option gives summaries. A runtime boolean gives their union. This also
works with full-response mode, `atSnapshot()`, and `paginatePages()`. Full items
add `content`, `properties`, `fragments`, `assets`, `schema`, and full version
metadata. Channel and snapshot metadata stay in the page envelope. The generated
`PublishedEntryContent` and `PublishedEntrySummary` types are public.

With a collection selector, the list returns direct entries by default.
`descendants: true` includes nested collections and requires a collection selector.
Use `collectionPath: "/"` with descendants for the complete snapshot tree. Without
a scope, the list includes all snapshot entries.

Filters use the same contract as search: text `any`/`all`/`none`, number and date
comparisons, and boolean equality. All filters must match. Text comparison ignores
case; missing or incompatible properties do not match negative operators. Filters
use the assigned version's property records, including fields between content
blocks. They do not use the current draft or the search index. The SDK encodes
nested filters automatically.

Keep the same scope and filters across pages. Limits remain 1–100 entries and up
to 20 filters, with the existing per-filter bounds. Assets are URLs and metadata.
The server validates each returned full document against its recorded schema. An
invalid document fails the page with `CONTENT_SCHEMA_INVALID`; it is not skipped.
Summary reads do not load or validate full documents.

### Structured content

Use `toStructuredContent()` to remove property and fragment wrappers:

```ts
import { toStructuredContent } from "@andesine/sdk";

const page = await client.content.get({ path: "/Tutorials/Welcome" });
const tutorial = toStructuredContent(page);

console.log(tutorial.properties); // Each property's value, keyed by derived key.
console.log(tutorial.fragments); // Each fragment's content, keyed by derived key.
console.log(tutorial.schema, tutorial.path); // Other response fields are preserved.
```

The helper also accepts current full entries and full published list items:
`page.data.map(toStructuredContent)`. Property and fragment maps stay separate.
Values such as `null`, false, zero, empty strings, and empty arrays are preserved.
The helper is synchronous. It creates a new object and maps, does not change its
input, and retains references to values and other fields. It does not validate,
coerce, fetch, or generate collection-specific types. Types follow the supplied
input; API property values retain their generated union types. `StructuredContent<T>`
is available for explicit annotations. Collection type generation remains deferred.

## Publishing preconditions

Pass `expectedSnapshotID` to publish, unpublish, or delete a channel only if its
publication state still matches a prior read:

```ts
const reviewed = await client.content.listEntries({ channel: "published", limit: 1 });

await client.publishing.publishEntry({
  entryID: "ent_123",
  channel: "published",
  expectedSnapshotID: reviewed.snapshotID
});
```

The server checks the channel inside the mutation transaction. A mismatch returns
HTTP 409 with code `PUBLISHING_SNAPSHOT_CHANGED`, the expected and current snapshot
IDs, and a hint. Read the current state and review it before another write. Omitting
the precondition makes no comparison with your prior read. Draft edits are not
covered by this check.

`setCollection()` and `bulkSetCollections()` can affect multiple channels. Their
optional `expectedSnapshots` map checks each supplied channel before the change,
for example `{ published: "snp_123", preview: "snp_456" }`. Omitted channels are not
checked. `revertChanges()` continues to require its reviewed `snapshotID`.

Bulk inputs accept at most 100 selected items. Revert selections share that limit
across entries and collections. A selected collection can contain more descendants;
this is an input limit, not a limit on the number of affected records. Separate bulk
requests are separate transactions.

## Instance information

```ts
const instance = await client.instance.get();
console.log(instance.features.imageStorage, instance.features.semanticSearch);
console.log(instance.features.aiAnswers, instance.features.aiAnswerStreaming);
console.log(instance.limits.maxUploadBytes, instance.limits.assetStorageBytes);
console.log(instance.limits.maxPageSize, instance.limits.maxBulkItems);
```

This authenticated call returns the API contract version, configured features,
and effective workspace limits, including the search result limit. Features do
not grant permissions or report live service health. Storage limits are capacity,
not remaining space. `aiAnswers` requires search, embedding, and answer-model
configuration. `aiAnswerStreaming` reports the configured streaming implementation;
the AI provider must support Chat Completions SSE. These flags do not report
remaining quota. The SDK makes no discovery request automatically.

## Types

Named types are generated from the public OpenAPI components. Import them directly
or through the type-only `Andesine` namespace:

```ts
import type { Entry, PropertyFilter, Andesine } from "@andesine/sdk";

const renderEntry = (entry: Entry): string => entry.name;
const renderAsset = (asset: Andesine.Asset): string => asset.filename;
const filter: PropertyFilter = {
  kind: "text",
  key: "category",
  values: ["guides"]
};
```

The exports cover entries and properties; assets, files, and analysis; collections;
entry and schema versions; schema fields, inheritance, and migrations; memberships,
invites, roles, and permissions; published content and trees; publishing channels;
search results and filters; and pagination.

`Entry` includes content, fragments, and properties. `EntrySummary` is the metadata
returned by entry lists and creation. `SchemaDefinition` describes a collection's
content schema; `CollectionSchema` contains its local and effective schema details.
Types describe the HTTP data: dates are strings and binary values are `Blob`.
Search filter types describe inputs, so fields with server defaults can be omitted.

Every public operation also has generated input, output, and error aliases. Their names
combine the resource and method with `Input`, `Output`, or `Error`:

```ts
import type { EntriesCreateInput, EntriesListOutput, Andesine } from "@andesine/sdk";

const input: EntriesCreateInput = { name: "Getting started" };
type EntryPage = EntriesListOutput;
type SearchRequest = Andesine.SearchCurrentInput;
```

Operation inputs match the SDK's single argument object, including path, query,
and body fields. Outputs match the returned data, excluding the full-response
wrapper. All these exports, including `Andesine`, are types only and add no runtime
code. The generic helpers and raw `components`, `operations`, and `paths` types
remain available:

```ts
import type { OperationInput, OperationOutput } from "@andesine/sdk";

type CreateEntry = OperationInput<"entries.create">;
type EntryPage = OperationOutput<"entries.list">;
```

Content types are structurally compatible with `@andesine/converters`. Neither
public package imports the private editor or backend at runtime.

## Maintainer workflow

From the repository root:

```sh
pnpm --filter @andesine/backend openapi:export
pnpm --filter @andesine/sdk generate
pnpm --filter @andesine/sdk build
```

The export calls oRPC's OpenAPI generator on the same contracts implemented by
the server. It imports no request handlers or service initialization and needs no
backend environment variables, database, queue, or running server. The export
uses the default upload-size limit; self-hosted instances can set a different
limit, which their own OpenAPI document reflects. The checked-in document's
server URL is a placeholder; consumers must supply their instance URL.

Commit `openapi.json` and `src/generated/` together. Do not edit generated files.
Public schema names are defined in the backend's
`src/contracts/schemas/public.ts` registry. Adding a component there generates its
named SDK export and its `Andesine` member; no SDK alias list needs to be updated.
The generator also creates input/output/error aliases for each public operation and
rejects invalid or duplicate public type names.
Generation is a maintainer operation, never an install-time operation. `prepack`
checks types, bundles ESM and declarations with Rolldown, and checks
package metadata with publint. These 0.x packages are pre-release; review
generated changes together with API changes.

See the [release guide](https://github.com/vriteio/andesine/blob/andesine/packages/public/README.md)
for archive checks, versioning, and npm publishing. This package uses the
[MIT license](./LICENSE).

### Generator choice

Both Hey API 0.99.0 and openapi-typescript 7.13.0 generated output from the Andesine
spec. This package uses openapi-typescript and openapi-fetch. A small generated
resource layer supplies the flat argument objects and instance methods; a shared
transport supplies errors, retries, multipart serialization, and full responses.

Hey API generated operation functions and a larger client layer, but still needed
adaptation for the selected public interface and multipart operation defaults.
The selected approach keeps these behaviors in one maintained transport and
keeps runtime dependencies small.

## Content names

Sibling entries and collections share names. Names are trimmed, normalized to
Unicode NFC, and compared case-sensitively. Names cannot contain `/` or equal
`.` or `..`. The limit is 300 JavaScript string units. The collection name `~`
is reserved for the internal workspace root. Root entries and root collections
share the same level.

Creation chooses an available name, adding suffixes such as ` (2)` when needed.
Use the returned name rather than assuming that your requested name was saved.
Rename, move, and restore operations reject conflicts. Deleted items release
names; a schema move temporarily reserves its source name for rollback.

`CONTENT_NAME_CONFLICT` (409) includes `name`, `parentID`, and optional `hints`.
Use `error.is("CONTENT_NAME_CONFLICT")` to access typed data. Renaming never
chooses a different name for you.

## Content paths

Read an entry by ID or by path. Use exactly one selector:

```ts
const current = await client.entries.get({ path: "/Docs/Getting started" });
const tree = await client.content.getTree({ collectionPath: "/Docs" });
const content = client.atSnapshot(tree.snapshotID);
const page = await content.get({ path: "/Docs/Getting started" });
const definition = await content.getSchema({ path: page.path });
const activeSchema = await client.schemas.get({ collectionPath: "/Docs" });
```

Paths use names from the tree, with `/` between levels. Names are case-sensitive;
each segment is trimmed and NFC-normalized. Pass decoded names to the SDK. It
encodes query parameters once, so a name containing the literal text `%2F` keeps
that text. Empty segments, trailing slashes, `.` and `..` are invalid.

An absolute path starts with `/`. An anchored path starts with a collection ID,
such as `coll_67bqzSOb9kct2DaVkTwT53/Getting started`. The anchor must exist in the
selected current tree or snapshot. A name that looks like an ID is still a name
when it occurs in an absolute path. A bare collection ID is also a valid
`collectionPath`. `/` selects the root. Neither selects an entry on its own.

Current entry and collection responses include their canonical absolute `path`.
Published content, trees, and list results use snapshot collection names and the
titles of assigned versions. Draft renames, moves, and deletions do not change
those snapshot paths. Full published content also includes `id` and `collectionID`.
Saved versions remain ID-based because a version alone has no snapshot location.

`content.getTree({ collectionPath: "/" })` returns a virtual root collection with
`id: null`, `name: ""`, and `path: "/"`. It contains top-level entries and collections.

`entries.list`, `collections.list`, `content.listEntries`, and
`content.listCollections` accept either `collectionID` or `collectionPath` to
select direct children. Keep the same scope while paging. With no scope,
`collections.list` selects root children; the other lists select all accessible
items. `collections.list` now uses these fields instead of `ancestorID`.
Search accepts the same collection selectors and includes descendants. Its `/`
scope covers the whole accessible tree. Search results include a canonical entry
`path` and an optional heading `anchor`.

HTTP reads use query selectors on `GET /entries/get`, `GET /content/entries/get`,
`GET /content/tree`, and `GET /schemas/collection`. The published schema route
remains `GET /content/entries/schema`. These replace the former ID-in-path GET
routes; mutation routes are unchanged. SDK method names are unchanged.

Publication checks names across the complete next snapshot, including retained
versions. `PUBLISHING_NAME_CONFLICT` (409) includes `name`, `parentID`, and `hints`.
Publish related replacements together or unpublish the conflict first. A draft
rename alone does not remove a name from an existing publication. A rejected
publication leaves the channel and its snapshot unchanged.

## Search and source links

Published search results include required `channel`, `snapshotID`, `versionID`,
and canonical entry `path` fields. `entryID` remains the stable identity.
An optional `anchor` identifies a heading in that version; a result before any
heading has no anchor. Current results have their indexed working path. Search
index updates are asynchronous, so current paths can briefly lag draft changes.

```ts
const matches = await client.search.published({
  channel: "published",
  query: "installation"
});

for (const result of matches.results) {
  const page = await client.atSnapshot(result.snapshotID).get({
    entryID: result.entryID
  });
  const pathname = result.path.split("/").map(encodeURIComponent).join("/");
  const link = pathname + (result.anchor ? `#${encodeURIComponent(result.anchor)}` : "");
  // Map pathname to your docs site's route and render page with matching heading IDs.
}
```

Paths and anchors are decoded data, not application URLs. Encode each path segment
when building a URL. Reading by `entryID` at the source snapshot preserves the
content version even if the channel advances. A retained snapshot can expire;
handle an unavailable snapshot with a new search. Search still uses the current
channel and does not support historical snapshot queries.

The converters' `getHeadingAnchors()` helper derives matching targets. HTML
conversion applies those IDs; other renderers must preserve AST IDs or apply the
helper themselves. Duplicate headings are numbered across all fragments. Existing
`headingPath` is retained for editor navigation. Answer sources use the same path,
snapshot, and anchor metadata, plus a numbered citation `id` and `relevance`.

## AI answers

Call these methods from your server with an API key. For published documentation,
grant `ai-answers` and `read:publishing`. For current workspace content, grant
`ai-answers`, `read:entries`, and `read:collections`. Write permissions also supply
the corresponding read access, but never imply `ai-answers`. The key editor has a
separate AI answers option.

```ts
import type { AnswerHistoryMessage, PublishedAnswerSource } from "@andesine/sdk";

const history: AnswerHistoryMessage[] = [];
const result = await client.search.askPublished({
  channel: "published",
  collectionPath: "/Docs",
  question: "How do I install Andesine?",
  history
});
const sources: PublishedAnswerSource[] = result.sources;

// [1] in result.answer refers to the source with id === 1.
// Use each source's path/anchor for links and snapshotID/entryID for content reads.
history.push(
  { role: "user", content: "How do I install Andesine?" },
  { role: "assistant", content: result.answer }
);
```

`client.search.askCurrent({ question, collectionPath, history })` reads current
content with the caller's collection access rules. Both methods accept optional
property `filters` and either `collectionID` or `collectionPath`. Published scopes
resolve within the channel's current snapshot. Omit the collection selector to
search all content available to the caller.

Responses contain the complete `answer` and `sources`. The generated `Answer`,
`PublishedAnswer`, `AnswerSource`, `PublishedAnswerSource`, and
`AnswerHistoryMessage` types are also available through `Andesine`.
Both complete and streamed answers use the same inputs and source-selection rules.

The limits are 1,000 characters per question, 10 history messages of up to 4,000
characters each, and 20 property filters. History is supplied per request; the SDK
does not store it. Trim history before sending a later question. The existing Ask
AI rate limit is 10 requests per 60 seconds per credential. API usage metering
is unchanged: a successful complete response counts once when billing is enabled.
A rate-limit error includes `Retry-After` and `data.retryAfterSeconds`. Provider
failures return `SERVICE_UNAVAILABLE` with hints. Answer POST requests are never
automatically retried, even when read retries are enabled.

## Recorded content schemas

Full entry, version, and published-content responses include `schema`, containing
`revisionID` and `hash`, or `null` for content without a recorded schema. Reads and
publication validate the document against that recorded revision, including
inherited fields. They do not repair content or use the latest schema instead.

```ts
const page = await client.content.get({ entryID: "ent_123" });
const definition = await client.atSnapshot(page.snapshotID).getSchema({
  entryID: page.id
});

// Use a hash saved by your application when it requires a specific definition.
const checked = await client.content.get({
  entryID: page.id,
  snapshotID: page.snapshotID,
  expectedSchemaHash: "YOUR_SAVED_64_CHARACTER_SHA256_HASH"
});
```

`content.getSchema()` uses published-content access. It returns the selected
entry's recorded definition or `null`. `schemas.getRevision({ revisionID })`
requires collection-read access and returns an exact revision, including inactive
revisions. Both return `{ revisionID, hash, definition }`. The definition combines
inherited fields without internal source metadata and matches the recorded hash.

`expectedSchemaHash` is also available on `entries.get()`, `versions.get()`, and
`publishing.getEntryVersion()`. A mismatch, including content without a schema,
returns `CONTENT_SCHEMA_MISMATCH` (409) with the expected hash and actual metadata.
Invalid stored content returns `CONTENT_SCHEMA_INVALID` (500) on delivery or (409)
on publication, with issue paths and available entry, version, and revision IDs.
`SCHEMA_FIELD_KEY_CONFLICT` (409) identifies conflicting derived field keys.
Use `error.is(code)` to read the generated error data types. Schema definitions
remain readable when their associated document is invalid.

## Operation documentation and error hints

All public methods include generated summaries, descriptions, API key permissions,
and input examples in editor tooltips. The same examples appear in OpenAPI parameters
and request bodies. IDs and file contents in examples are placeholders; replace them
with values from your instance. Role permissions differ from API key permissions.

Error declarations come from the backend contracts. `error.is(code)` narrows `data`
only when the server marks the error as defined by its contract. An undeclared error,
proxy response, or network failure does not become a typed domain error. Handle the
remaining error cases as well. `data` stays `unknown` until narrowed.

`APIErrorCode`, `APIErrorBody`, `APIErrorData<Code>`, and
`OperationError<"entries.create">` are available for application types. Operation
aliases such as `EntriesCreateError` are also available as
`Andesine.EntriesCreateError`. These types describe declared errors, not every
possible failure. TypeScript does not enforce the types of thrown errors.

`data.hints` is optional advice. `error.hints` returns an empty array when no hints
are present. Use stable codes and structured data for program logic; never parse
hint text. Hints do not trigger retries. Automatic retries remain disabled by default.

Common errors can include validation `issues`, `missingPermissions`, `requiredPlan`,
or `retryAfterSeconds`. Domain errors include `SCHEMA_MIGRATION_IN_PROGRESS`,
`PUBLISHING_SNAPSHOT_CHANGED`, `ROLE_NAME_DUPLICATE`, `ROLE_NAME_INVALID`,
`MEMBERSHIP_ALREADY_EXISTS`, and `INVITE_ALREADY_PENDING`. Migration and snapshot
conflicts now use their specific codes instead of the generic `CONFLICT` code.

Asset operation errors can also include the current `assetStatus`, expected and
actual file sizes and checksums, or storage `limitBytes`, `usedBytes`, and
`requiredBytes`. Storage reservations include processed image variants.
These fields are declared on the applicable operation error types, such as
`AssetsUploadError` and `AssetsRegisterError`; not every error with the same code
contains asset data. With `AndesineAPIError`, check for the field before using it.
Known rate-limit delays appear in both `data.retryAfterSeconds` and `Retry-After`.
Concurrency limits have no fixed delay and only supply a hint.

## Streaming AI answers

`search.askCurrentStream()` and `search.askPublishedStream()` return a promise of
an async iterator. They require the same permissions and inputs as their complete
answer methods. Published source types require `snapshotID`, `versionID`, and
`channel`. `AnswerEvent` and `PublishedAnswerEvent` are available directly and
through `Andesine`.

```ts
const controller = new AbortController();
const events = await client.search.askPublishedStream(
  { channel: "published", collectionPath: "/Docs", question: "How do I install Andesine?" },
  { signal: controller.signal, timeout: 120_000 }
);

for await (const event of events) {
  if (event.type === "sources") console.log(event.sources);
  if (event.type === "textDelta") process.stdout.write(event.text);
  if (event.type === "completed") console.log(event.answer);
}
```

The order is one `sources` event, non-empty `textDelta` events, then one
`completed` event. A no-source answer may complete without deltas. The completed
answer contains the final text and sources. Deltas contain plain text, including
any Markdown syntax; choose how to render it in your application.

Use `controller.abort()` to cancel, or `break` from the loop to stop early. If you
open a stream but do not iterate it, call `await events.return?.()` to close it.
The request timeout covers both opening and consuming the stream; `timeout: 0`
disables it. The SDK never reconnects or retries generation, even if read retries
are enabled. `response: "full"` returns the iterator in `data`, with the actual
response status and headers.

Errors before SSE headers are normal `AndesineAPIError` failures. A declared
error after headers throws `AndesineStreamError`, which extends `AndesineAPIError`
and supports `.is()`, `code`, `data`, and `hints`. Its `status` is the error status
from the frame; `response.status` remains the actual HTTP status, usually 200.
Malformed streams throw `AndesineStreamProtocolError` with `INVALID_STREAM`.
Missing completion or an interrupted body uses `INCOMPLETE_STREAM`. These are
local protocol errors, not API errors with an invented HTTP status. Abort and
timeout reasons are preserved.

A stream counts as one API call when generation starts, including generation that
later fails or is cancelled. Source preparation alone is not charged. The existing
Ask AI rate limit and quota checks run before opening the stream. Usage headers
show the allowance when the stream opens; chunks do not update headers or create
additional usage records.

### Forward a stream from your server

The optional `@andesine/sdk/streaming` entry has no framework dependency. It uses
standard Fetch types, preserves backpressure and cancellation, and forwards no
upstream headers or credentials.

```ts
import { toAnswerResponse } from "@andesine/sdk/streaming";

async function answerRequest(request: Request): Promise<Response> {
  const { question } = await request.json();
  const events = await client.search.askPublishedStream(
    { channel: "published", collectionPath: "/Docs", question },
    { signal: request.signal, timeout: 120_000 }
  );

  return toAnswerResponse(events);
}
```

Keep the configured `client` and API key on your server. Handle errors before
`toAnswerResponse()` with your application's normal HTTP error handler. Once
streaming starts, the helper preserves typed API error frames and uses a generic
error frame for other failures. Its response disables caching and requests that
proxies do not buffer the stream. Your hosting platform must support streamed
responses.

A browser can read the forwarded response without an Andesine API key:

```ts
import { readAnswerStream } from "@andesine/sdk/streaming";

const controller = new AbortController();
const response = await fetch("/api/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: "How do I install Andesine?" }),
  signal: controller.signal
});

for await (const event of await readAnswerStream(response, { signal: controller.signal })) {
  console.log(event);
}
```

Both helpers use oRPC's SSE framing: `event: message` carries an answer event as
JSON; `event: error` carries the error envelope. Completion is an application
`completed` event. Comments are ignored, and a transport `done` event cannot
replace application completion. Event IDs and retry fields never trigger
reconnection.
