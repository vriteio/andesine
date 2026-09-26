# Webhooks

Use `client.webhooks` to manage outgoing Andesine webhooks. Use
`@andesine/sdk/webhooks` in your receiving server to verify incoming requests.
These are separate tasks: an Andesine API credential manages the endpoint; its
`whsec_` signing secret authenticates deliveries. Keep both in server-side storage.

## Configure an endpoint

The API key needs `webhooks` and the read permission for each resource type its
events send (for example `read:entries` for entry events). OAuth also requires an
explicit workspace and the member's current permissions. The stored scope belongs
to the workspace, independently of the creator's account.

```ts
import { createClient } from "@andesine/sdk";

const client = createClient({ apiKey: process.env.ANDESINE_API_KEY });
const { endpoint, secret } = await client.webhooks.create({
  name: "Search index",
  url: "https://receiver.example.com/andesine",
  enabled: false,
  eventTypes: ["entry.content_saved", "entry.deleted"],
  schemaVersion: 1,
  collections: { mode: "all" },
  channels: { mode: "all" },
  restrictedContent: false
});
```

Save `secret` in your receiver's secret store. It is shown once. Do not print it
or place it in frontend code. Webhooks are enabled on creation unless `enabled` is
`false`; this example enables it after a test. Select specific collection roots
instead of `all` to receive events only for those subtrees. A resource moved out
of them is reported without its new location. Restricted content needs
workspace-wide restricted-content read authority and explicit approval.

After deploying the receiver with that secret, send a synthetic test:

```ts
const { deliveryID } = await client.webhooks.sendTest({
  id: endpoint.id,
  expectedRevision: endpoint.revision,
  type: "entry.content_saved"
});
const details = await client.webhooks.getDelivery({ id: endpoint.id, deliveryID });
// Inspect details again later if details.delivery.state is still pending/in_flight.
```

Tests contain example resource IDs and `test: true`. They get one attempt, can
run while disabled, and have a ten-minute queue/completion deadline. Record the
result, but do not process a test as a real content change. A successful test
does not enable the endpoint. Enable it explicitly with `update`, using the latest
`revision`. Configuration conflicts require a fresh `get` and review.

The resource provides `list`, `get`, `create`, `update`, `delete`,
`rotateSecret`, `sendTest`, `listDeliveries`, `getDelivery`, `listRuns`,
`listAttempts`, and `redeliver`. Lists use the normal cursor/limit pattern. Read
access permits metadata; payload previews also require content read authority.

## Verify before parsing

```ts
import { verifyWebhook, WebhookVerificationError, type WebhookEvent } from "@andesine/sdk/webhooks";

const event: WebhookEvent = await verifyWebhook({
  body: rawBodyBytes,
  headers: incomingHeaders,
  secret: signingSecret
});

if (!event.test && event.type === "entry.content_saved") {
  // The discriminated union narrows data to content_saved fields.
  console.log(event.data.contentHash);
}
```

`body` is a `Uint8Array` (including Node `Buffer`) or unchanged UTF-8 text.
Never pass parsed JSON, call `JSON.stringify` before verification, or let JSON
middleware change the body. Byte input is preferred. `headers` accepts standard
`Headers` or a case-insensitive record, including Node's incoming headers.
Ambiguous duplicate signature headers are rejected.

Both verification helpers return a promise. They authenticate the exact
`webhook-id.webhook-timestamp.body` bytes with HMAC-SHA256, then parse UTF-8 JSON
and validate the complete public event schema. The authenticated header ID must
match `event.id`. Signature comparisons use native Web Crypto. Timestamps more
than five minutes old or in the future are rejected; keep the receiver clock
synchronized. There is no option to disable verification or the time check.
The time check uses the attempt timestamp, not `occurredAt`.

The verifier accepts at most 256 KiB and never fetches Andesine or another
service. `verifyWebhookRequest` consumes the body once, checks its size while
reading, and passes the bytes to the same verifier. It does not clone the request.
The receiving server must set its own body-read deadline and request/header limits.

`WebhookVerificationError.code` is one of:

| Code                                       | Meaning                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `INVALID_HEADERS`                          | Required signature headers are missing, malformed, or ambiguous               |
| `INVALID_SIGNATURE`                        | No supplied v1 signature matches a configured key                             |
| `TIMESTAMP_TOO_OLD` / `TIMESTAMP_TOO_NEW`  | Attempt timestamp is outside the five-minute window                           |
| `INVALID_PAYLOAD`                          | Authenticated body is not valid UTF-8 JSON or does not match the event schema |
| `PAYLOAD_TOO_LARGE`                        | Body exceeds 256 KiB                                                          |
| `UNSUPPORTED_EVENT` / `UNSUPPORTED_SCHEMA` | Authenticated event needs a newer SDK                                         |
| `EVENT_ID_MISMATCH`                        | Signed header and payload event IDs differ                                    |

Errors contain fixed messages, not the body, secret, or signature. Invalid local
secret configuration throws `TypeError`; unavailable cryptography or stream
failures propagate as runtime errors. Do not turn these failures into success.
Unsupported events need an SDK update before replay. Inspect only error codes in
logs; do not log the request headers, signing secret, or sensitive payload data.

## Standard Request receiver

`accept` below must durably and idempotently store the event before it resolves.
The PostgreSQL inbox example below shows that contract. Mount this handler only
at the configured receiver path. Load its expected workspace and secret from
trusted configuration, not from the incoming event.

```ts
import {
  verifyWebhookRequest,
  WebhookVerificationError,
  type WebhookEvent,
  type WebhookVerificationOptions
} from "@andesine/sdk/webhooks";

interface ReceiverOptions extends WebhookVerificationOptions {
  workspaceID: string;
  integrationID: string;
  accept: (integrationID: string, event: WebhookEvent) => Promise<void>;
}

export async function receive(request: Request, options: ReceiverOptions): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  try {
    const event = await verifyWebhookRequest(request, options);

    if (event.workspaceID !== options.workspaceID) return new Response(null, { status: 403 });

    await options.accept(options.integrationID, event);
    return new Response(null, { status: 204 });
  } catch (error) {
    const status =
      error instanceof WebhookVerificationError
        ? error.code === "PAYLOAD_TOO_LARGE"
          ? 413
          : 400
        : 503;

    return new Response(null, { status });
  }
}
```

## Node HTTP receiver

Use the raw stream before middleware calls `setEncoding` or parses JSON. Configure
an HTTP request timeout and mount the handler at your receiver route. `options`
has the same contract as the Request example above.

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyWebhook, WebhookVerificationError } from "@andesine/sdk/webhooks";

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  let size = 0;

  for await (const chunk of request) {
    if (!Buffer.isBuffer(chunk)) throw new TypeError("Read the request before text middleware");

    size += chunk.byteLength;

    if (size > 262_144) throw new WebhookVerificationError("PAYLOAD_TOO_LARGE");

    chunks.push(chunk);
  }

  return Buffer.concat(chunks, size);
}

export async function receiveNode(
  request: IncomingMessage,
  response: ServerResponse,
  options: ReceiverOptions
): Promise<void> {
  if (request.method !== "POST") {
    response.writeHead(405, { Connection: "close" }).end();
    return;
  }

  try {
    const body = await readRawBody(request);
    const event = await verifyWebhook({ body, headers: request.headers, secret: options.secret });

    if (event.workspaceID !== options.workspaceID) {
      response.writeHead(403).end();
      return;
    }

    await options.accept(options.integrationID, event);
    response.writeHead(204).end();
  } catch (error) {
    const status =
      error instanceof WebhookVerificationError
        ? error.code === "PAYLOAD_TOO_LARGE"
          ? 413
          : 400
        : 503;

    if (!response.destroyed) response.writeHead(status, { Connection: "close" }).end();
  }
}
```

## Durable acceptance and duplicate events

Delivery is at least once. A receiver can commit a change and lose its response;
Andesine then retries the same event. Manual replay also keeps the event ID.
Signatures and timestamps change on each attempt and are not deduplication keys.
There is no ordering guarantee.

For a PostgreSQL receiver, use a durable inbox like this in **your** database:

```sql
CREATE TABLE andesine_inbox (
  integration_id text NOT NULL,
  event_id text NOT NULL,
  event jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (integration_id, event_id)
);
```

```ts
import type { Pool } from "pg";
import type { WebhookEvent } from "@andesine/sdk/webhooks";

export function createInbox(pool: Pool) {
  return async (integrationID: string, event: WebhookEvent): Promise<void> => {
    await pool.query(
      `INSERT INTO andesine_inbox (integration_id, event_id, event)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (integration_id, event_id) DO NOTHING`,
      [integrationID, event.id, JSON.stringify(event)]
    );
  };
}
```

That one statement atomically records acceptance and its deduplication key.
Return 2xx only after it commits; duplicates also return 2xx. Process the inbox
with a background worker. Apply local business changes and mark the inbox row
processed in the **same database transaction**. Skip business changes for `test`
events. External side effects need their own idempotency key or transactional
outbox. A signature check alone does not prevent repeated processing.

Keep deduplication keys for at least the sender's maximum supported replay period:
workspace retention defaults to seven days Free or 30 days Pro and can be longer
on self-hosted systems. Keeping keys indefinitely is also valid. Payloads can be
removed earlier after processing if their deduplication keys remain. Use the
configured integration/endpoint and event ID together: two endpoints can receive
different authorized projections of the same event. Do not deduplicate by
`operationID`, which can group several distinct events.

Events report committed changes, but an API read can already return a newer
state. Treat events as notifications to refresh state when appropriate. Deleted
or restricted resources can become unavailable. Publication snapshot references
can expire under the workspace policy; webhooks do not pin snapshots. Handle
missing references explicitly.

## Rotation, replay, and recovery

Normal rotation returns a new secret once and signs with both old and new keys
for 24 hours. Deploy the new secret during that window. `secret` may also be an
array of one or two `whsec_` values during receiver rollout. Remove the old value
after rollout; an old configured key remains trusted by your receiver until you
remove it. Immediate rotation and URL changes retire previous signing keys.
Retire them at the receiver too.

To replay, first get the endpoint and show its current URL to the manager. Pass
its reviewed `destinationRevision` to `redeliver` with the delivery ID. Replay
requires an enabled endpoint and current authority over its full scope and the
retained payload. An active run returns a conflict. Replay preserves event ID,
payload, and original expiry; its retry deadline is at most 72 hours from replay
and never exceeds that expiry. An expired delivery returns not found.

Return 2xx as soon as durable acceptance is complete. Andesine uses a 15-second
HTTP deadline and retries normal failures within a bounded run. A disabled
endpoint needs explicit re-enabling. Enabling does not replay past work; inspect
history and request each needed replay. SDK mutation calls are not automatically
retried. If a test/replay response is lost, inspect history before repeating it.

## Runtime and packaging

The verifier is an isolated ESM entry point. It uses Web Crypto (`crypto.subtle`
HMAC-SHA256), `TextEncoder`, fatal UTF-8 `TextDecoder`, `atob`/`btoa`, and `Headers`.
The Request helper also needs the Fetch/Streams APIs. Node.js 22+ supplies these
APIs. Worker runtimes must supply the same APIs; no Node `Buffer`, backend,
database, network access, runtime schema compilation, or `eval` is required by
the verifier. This is a runtime requirement, not a claim that every worker
platform has been tested. Browsers are not a place to store signing secrets.

The Rolldown build generates the payload validator from the checked-in OpenAPI
event schema through a virtual module and bundles it directly into `dist/webhooks.js`.
No generated validator JavaScript or declarations are stored in `src/generated`.
Ajv and ajv-formats are build-time dependencies; their required helpers are
included in the verifier bundle. The build copies their installed license notices
into `dist/THIRD_PARTY_LICENSES.txt`, which is included in the published package.
The root SDK entry point does not import the verifier. Regenerate OpenAPI, the
SDK, and the CLI manifest together when public contracts change.
