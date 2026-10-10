import * as z from "zod";
import {
  extensionStorageKeyType,
  extensionStorageLimits,
  extensionStorageListInputType
} from "./storage";

type ExtensionEnvelope = z.output<typeof envelopeType>;
type ExtensionLoaderReady = z.output<typeof extensionLoaderReadyType>;
type ExtensionPatch = z.output<typeof extensionPatchType>;
type ExtensionHostMessageBody = z.output<typeof hostBodyType>;
type ExtensionHostMessage = z.output<typeof extensionHostMessageType>;
type ExtensionWorkerMessageBody = z.output<typeof workerBodyType>;
type ExtensionWorkerMessage = z.output<typeof extensionWorkerMessageType>;
type ExtensionRequestMethod = keyof typeof extensionRequestParams;
type ExtensionRequestErrorCode = z.output<typeof extensionRequestErrorCodeType>;
type ExtensionRequestParams<M extends ExtensionRequestMethod> = z.output<
  (typeof extensionRequestParams)[M]
>;

const EXTENSION_PROTOCOL_VERSION = 1;
const extensionProtocolLimits = {
  /** Serialized size of one port message. */
  messageSize: 256 * 1024,
  messagesPerSecond: 200,
  handshakeTimeout: 10_000,
  heartbeatInterval: 5_000,
  heartbeatTimeout: 15_000,
  patchesPerMessage: 1000,
  /** Live nodes of one extension, across its views. */
  nodes: 10_000,
  textLength: 10_000,
  callbackArguments: 10,
  pendingRequests: 32
} as const;
/** Every port message carries the protocol, sandbox generation, and per-direction sequence. */
const envelopeType = z.strictObject({
  protocol: z.literal(EXTENSION_PROTOCOL_VERSION),
  generation: z.int().positive(),
  sequence: z.int().min(0)
});
/** The only window message the host accepts: from the loader, before the port exists. */
const extensionLoaderReadyType = z.strictObject({
  type: z.literal("andesine:ready"),
  protocol: z.literal(EXTENSION_PROTOCOL_VERSION)
});
const nodeIDType = z.int().positive();
const viewIDType = z.string().min(1).max(100);
const textType = z.string().max(extensionProtocolLimits.textLength);
const propNameType = z.string().regex(/^[A-Za-z][A-Za-z\d]{0,63}$/);
const propsType = z.record(propNameType, z.json());
/** One view tree change; node IDs are unique per sandbox and functions become callbacks. */
const extensionPatchType = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("root"), id: nodeIDType, viewID: viewIDType }),
  z.strictObject({ op: z.literal("create"), id: nodeIDType, component: z.string().max(64) }),
  z.strictObject({ op: z.literal("text"), id: nodeIDType, value: textType }),
  z.strictObject({ op: z.literal("setText"), id: nodeIDType, value: textType }),
  z.strictObject({
    op: z.literal("insert"),
    parent: nodeIDType,
    id: nodeIDType,
    before: nodeIDType.nullable()
  }),
  z.strictObject({ op: z.literal("remove"), id: nodeIDType }),
  z.strictObject({ op: z.literal("prop"), id: nodeIDType, name: propNameType, value: z.json() }),
  z.strictObject({
    op: z.literal("callback"),
    id: nodeIDType,
    name: propNameType,
    callback: nodeIDType
  }),
  z.strictObject({ op: z.literal("unset"), id: nodeIDType, name: propNameType })
]);
/** Document blocks as editor JSON; the editor validates them against its schema. */
const contentType = z.array(z.json()).min(1).max(100);
const textMediaType = z
  .string()
  .regex(/^(?:text\/[\w.+-]+|application\/(?:json|xml|typescript|javascript))$/, "Use a text type");
/** Parameters of the worker's requests to the host, by method. */
const extensionRequestParams = {
  "host.copyText": z.strictObject({ text: z.string().max(100_000) }),
  "host.downloadFile": z.strictObject({
    name: z.string().min(1).max(200),
    text: z.string().max(200_000),
    type: textMediaType.optional()
  }),
  "host.openURL": z.strictObject({ url: z.url({ protocol: /^https$/ }).max(2048) }),
  /** Shows a short notification, e.g. the result of a block action without UI. */
  "host.notify": z.strictObject({
    text: z.string().min(1).max(200),
    type: z.enum(["success", "error"]).optional()
  }),
  /** Replaces the blocks that a block action view was opened for. */
  "editor.replace": z.strictObject({ viewID: viewIDType, content: contentType }),
  /** Inserts blocks after those that a block action view was opened for. */
  "editor.insertAfter": z.strictObject({ viewID: viewIDType, content: contentType }),
  /** Updates the props of the element that an element view renders. */
  "editor.setElementProps": z.strictObject({
    viewID: viewIDType,
    props: z.record(z.string().max(100), z.json())
  }),
  /** Closes a block action view. */
  "view.close": z.strictObject({ viewID: viewIDType }),
  /** Storage entry or null. */
  "storage.get": z.strictObject({ key: extensionStorageKeyType }),
  /** Result: `{ key, updatedAt }`. */
  "storage.set": z.strictObject({ key: extensionStorageKeyType, value: z.json() }),
  /** Result: `{ deleted }`. */
  "storage.delete": z.strictObject({ key: extensionStorageKeyType }),
  /** Result: `{ data, hasMore }`. */
  "storage.list": z.strictObject({
    prefix: extensionStorageListInputType.shape.prefix,
    after: extensionStorageListInputType.shape.after,
    limit: z.int().min(1).max(extensionStorageLimits.pageEntries).optional()
  }),
  /**
   * A public API request with the member's session. Result: `{ status, contentType, body }`.
   * The host allows it only within the member's and the extension's permissions.
   */
  "api.fetch": z.strictObject({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z
      .string()
      .regex(/^\/(?!\/)/, "Use a path, e.g. /entries")
      .max(4096),
    body: z.string().max(200_000).optional()
  })
};
const extensionRequestErrorCodeType = z.enum([
  "invalid_request",
  "forbidden",
  "too_many_requests",
  "user_interaction_required",
  "unavailable",
  "failed"
]);
const hostBodyType = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("heartbeat"), id: z.int().min(0) }),
  z.strictObject({ type: z.literal("dispose") }),
  z.strictObject({
    type: z.literal("view.create"),
    viewID: viewIDType,
    entry: z.string().max(64),
    props: propsType
  }),
  z.strictObject({ type: z.literal("view.update"), viewID: viewIDType, props: propsType }),
  z.strictObject({ type: z.literal("view.dispose"), viewID: viewIDType }),
  z.strictObject({
    type: z.literal("callback"),
    callback: nodeIDType,
    args: z.array(z.json()).max(extensionProtocolLimits.callbackArguments)
  }),
  /** Effective permissions, backend URL, and non-secret configuration; sent on start and change. */
  z.strictObject({
    type: z.literal("context"),
    permissions: z.array(z.string().max(100)).max(50),
    backend: z.string().max(2048).nullable(),
    configuration: z.record(z.string(), z.json())
  }),
  /** Backend session token, renewed before expiry; null if unavailable. Verified via `instance`. */
  z.strictObject({
    type: z.literal("session"),
    token: z.string().max(200).nullable(),
    expiresAt: z.iso.datetime().nullable(),
    extensionID: z.string().max(100),
    instance: z.string().max(2048)
  }),
  z.strictObject({
    type: z.literal("response"),
    id: nodeIDType,
    result: z.json().optional(),
    error: z
      .strictObject({ code: extensionRequestErrorCodeType, message: z.string().max(500) })
      .optional()
  })
]);
const workerBodyType = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ready") }),
  z.strictObject({ type: z.literal("heartbeat"), id: z.int().min(0) }),
  z.strictObject({
    type: z.literal("error"),
    viewID: viewIDType.optional(),
    message: z.string().max(500)
  }),
  z.strictObject({
    type: z.literal("patch"),
    patches: z.array(extensionPatchType).min(1).max(extensionProtocolLimits.patchesPerMessage)
  }),
  /** `params` are validated by `extensionRequestParams[method]`. */
  z.strictObject({
    type: z.literal("request"),
    id: nodeIDType,
    method: z.enum(Object.keys(extensionRequestParams) as [ExtensionRequestMethod]),
    params: z.json()
  })
]);
const extensionHostMessageType = z.discriminatedUnion("type", [
  hostBodyType.options[0].extend(envelopeType.shape),
  hostBodyType.options[1].extend(envelopeType.shape),
  hostBodyType.options[2].extend(envelopeType.shape),
  hostBodyType.options[3].extend(envelopeType.shape),
  hostBodyType.options[4].extend(envelopeType.shape),
  hostBodyType.options[5].extend(envelopeType.shape),
  hostBodyType.options[6].extend(envelopeType.shape),
  hostBodyType.options[7].extend(envelopeType.shape),
  hostBodyType.options[8].extend(envelopeType.shape)
]);
const extensionWorkerMessageType = z.discriminatedUnion("type", [
  workerBodyType.options[0].extend(envelopeType.shape),
  workerBodyType.options[1].extend(envelopeType.shape),
  workerBodyType.options[2].extend(envelopeType.shape),
  workerBodyType.options[3].extend(envelopeType.shape),
  workerBodyType.options[4].extend(envelopeType.shape)
]);

export {
  EXTENSION_PROTOCOL_VERSION,
  extensionProtocolLimits,
  extensionLoaderReadyType,
  extensionPatchType,
  extensionRequestParams,
  extensionHostMessageType,
  extensionWorkerMessageType
};
export type {
  ExtensionEnvelope,
  ExtensionLoaderReady,
  ExtensionPatch,
  ExtensionHostMessageBody,
  ExtensionHostMessage,
  ExtensionWorkerMessageBody,
  ExtensionWorkerMessage,
  ExtensionRequestMethod,
  ExtensionRequestErrorCode,
  ExtensionRequestParams
};
