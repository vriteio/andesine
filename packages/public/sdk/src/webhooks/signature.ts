import { WebhookVerificationError } from "./error";

interface WebhookVerificationOptions {
  /** The endpoint's whsec_ secret, or up to two secrets during rotation. */
  secret: string | readonly string[];
}
interface VerifyWebhookInput extends WebhookVerificationOptions {
  /** Unchanged UTF-8 text or raw bytes, before any JSON middleware. */
  body: string | Uint8Array;
  headers: Headers | Record<string, string | string[] | undefined>;
}
interface SignatureHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

const WEBHOOK_MAX_BODY_BYTES = 262_144;
const WEBHOOK_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();
const readSignatureHeaders = (headers: VerifyWebhookInput["headers"]): SignatureHeaders => {
  const values = new Map<string, string>();
  const entries = headers instanceof Headers ? headers.entries() : Object.entries(headers);
  const required = ["webhook-id", "webhook-timestamp", "webhook-signature"];

  for (const [key, value] of entries) {
    const name = key.toLowerCase();

    if (!required.includes(name)) continue;
    if (typeof value !== "string" || values.has(name)) {
      throw new WebhookVerificationError("INVALID_HEADERS");
    }

    values.set(name, value);
  }

  const id = values.get("webhook-id") ?? "";
  const timestamp = values.get("webhook-timestamp") ?? "";
  const signature = values.get("webhook-signature") ?? "";

  if (
    !/^whevt_[A-Za-z\d]{1,22}$/.test(id) ||
    !/^(0|[1-9]\d{0,12})$/.test(timestamp) ||
    !signature ||
    signature.length > 1024
  ) {
    throw new WebhookVerificationError("INVALID_HEADERS");
  }

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);

  if (age > WEBHOOK_TOLERANCE_SECONDS) throw new WebhookVerificationError("TIMESTAMP_TOO_OLD");
  if (age < -WEBHOOK_TOLERANCE_SECONDS) throw new WebhookVerificationError("TIMESTAMP_TOO_NEW");

  return { id, timestamp, signature };
};
const decodeDigest = (value: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^[A-Za-z\d+/]{43}=$/.test(value)) return null;

  const decoded = atob(value);

  if (btoa(decoded) !== value) return null;

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};
const authenticateWebhook = async (
  input: VerifyWebhookInput
): Promise<{ id: string; body: Uint8Array<ArrayBuffer> }> => {
  const headers = readSignatureHeaders(input.headers);
  const secrets = typeof input.secret === "string" ? [input.secret] : input.secret;
  const keys =
    Array.isArray(secrets) && secrets.length > 0 && secrets.length <= 2
      ? secrets.map((secret) =>
          typeof secret === "string" && secret.startsWith("whsec_")
            ? decodeDigest(secret.slice(6))
            : null
        )
      : [];

  if (!keys.length || keys.some((key) => key === null)) {
    throw new TypeError("Provide one or two valid Andesine webhook signing secrets");
  }

  if (typeof input.body !== "string" && !(input.body instanceof Uint8Array)) {
    throw new TypeError("Webhook body must be unchanged text or raw bytes");
  }

  if (input.body.length > WEBHOOK_MAX_BODY_BYTES)
    throw new WebhookVerificationError("PAYLOAD_TOO_LARGE");

  // Copy caller-owned bytes before awaiting crypto so later mutation cannot change the verified payload.
  const body =
    typeof input.body === "string" ? encoder.encode(input.body) : new Uint8Array(input.body);
  const prefix = encoder.encode(`${headers.id}.${headers.timestamp}.`);
  const tokens = headers.signature.split(" ");
  const signatures: Array<Uint8Array<ArrayBuffer>> = [];

  if (body.byteLength > WEBHOOK_MAX_BODY_BYTES)
    throw new WebhookVerificationError("PAYLOAD_TOO_LARGE");
  if (tokens.length > 8) throw new WebhookVerificationError("INVALID_HEADERS");

  for (const token of tokens) {
    if (!token.startsWith("v1,")) continue;

    const signature = decodeDigest(token.slice(3));

    if (!signature) throw new WebhookVerificationError("INVALID_SIGNATURE");

    signatures.push(signature);
  }

  if (!signatures.length) throw new WebhookVerificationError("INVALID_SIGNATURE");

  const signed = new Uint8Array(prefix.byteLength + body.byteLength);

  signed.set(prefix);
  signed.set(body, prefix.byteLength);

  let verified = false;

  for (const bytes of keys) {
    const key = await crypto.subtle.importKey(
      "raw",
      bytes!,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Signature comparison is done by the runtime, not JavaScript string equality.
    for (const signature of signatures) {
      const matches = await crypto.subtle.verify("HMAC", key, signature, signed);

      verified = matches || verified;
    }
  }

  if (!verified) throw new WebhookVerificationError("INVALID_SIGNATURE");

  return { id: headers.id, body };
};

export { authenticateWebhook, WEBHOOK_MAX_BODY_BYTES };
export type { WebhookVerificationOptions, VerifyWebhookInput };
