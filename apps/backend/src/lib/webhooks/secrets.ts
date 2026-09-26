import { randomBytes } from "node:crypto";
import { publicID, toUUID } from "#backend/lib/primitives/id";
import type { SecretEncryption } from "#backend/lib/security/encryption";

interface WebhookSecretOwner {
  workspaceID: string;
  endpointID: string;
  destinationRevision: number;
}
interface WebhookSecretState {
  currentSecretCiphertext: Buffer | null;
  previousSecretCiphertext: Buffer | null;
  previousSecretExpiresAt: Date | null;
  secretRotatedAt: Date;
}
interface CreateWebhookSecretsInput extends WebhookSecretOwner {
  encryption: SecretEncryption;
  now: Date;
}
interface WebhookSecretResult {
  secret: string;
  state: WebhookSecretState;
}
interface ReadWebhookSecretsInput extends CreateWebhookSecretsInput {
  state: WebhookSecretState;
}
interface RotateWebhookSecretsInput extends ReadWebhookSecretsInput {
  mode: "overlap" | "immediate";
}

const WEBHOOK_SECRET_OVERLAP_MS = 24 * 60 * 60 * 1000;
const workspaceIDType = publicID("ws");
const endpointIDType = publicID("wh");

class WebhookSecretRotationConflictError extends Error {
  constructor() {
    super("A webhook signing key rotation is already in progress");
    this.name = "WebhookSecretRotationConflictError";
  }
}

const getSecretContext = (owner: WebhookSecretOwner): string => {
  if (!Number.isSafeInteger(owner.destinationRevision) || owner.destinationRevision < 1) {
    throw new Error("Invalid webhook signing destination revision");
  }

  return JSON.stringify([
    "webhook-signing",
    toUUID(workspaceIDType.parse(owner.workspaceID)),
    toUUID(endpointIDType.parse(owner.endpointID)),
    owner.destinationRevision
  ]);
};
const assertSecretTime = (now: Date): void => {
  if (!Number.isSafeInteger(now.getTime()) || now.getTime() < 0) {
    throw new Error("Invalid webhook signing time");
  }
};
const assertSecretState = (state: WebhookSecretState): void => {
  if (!state.currentSecretCiphertext) throw new Error("Webhook signing key is unavailable");
  if (Boolean(state.previousSecretCiphertext) !== Boolean(state.previousSecretExpiresAt)) {
    throw new Error("Invalid webhook signing key overlap");
  }

  assertSecretTime(state.secretRotatedAt);

  if (state.previousSecretExpiresAt) {
    assertSecretTime(state.previousSecretExpiresAt);

    if (state.previousSecretExpiresAt <= state.secretRotatedAt) {
      throw new Error("Invalid webhook signing key overlap");
    }
  }
};
const readSigningKey = (
  encryption: SecretEncryption,
  ciphertext: Buffer,
  context: string
): Buffer => {
  const key = encryption.decrypt(ciphertext, context);

  if (key.length !== 32) {
    key.fill(0);
    throw new Error("Invalid stored webhook signing key");
  }

  return key;
};
// Persist state under the workspace/endpoint locks and return the secret once.
// URL replacement must call this with the NEW destination revision, without overlap.
const createWebhookSecrets = (input: CreateWebhookSecretsInput): WebhookSecretResult => {
  const context = getSecretContext(input);

  assertSecretTime(input.now);

  const key = randomBytes(32);

  try {
    return {
      secret: `whsec_${key.toString("base64")}`,
      state: {
        currentSecretCiphertext: input.encryption.encrypt(key, context),
        previousSecretCiphertext: null,
        previousSecretExpiresAt: null,
        secretRotatedAt: input.now
      }
    };
  } finally {
    key.fill(0);
  }
};
const rotateWebhookSecrets = (input: RotateWebhookSecretsInput): WebhookSecretResult => {
  const { state, now, mode } = input;

  assertSecretTime(now);
  assertSecretState(state);

  if (now < state.secretRotatedAt) throw new Error("Webhook signing clock moved backwards");
  if (mode !== "overlap" && mode !== "immediate") throw new Error("Invalid key rotation mode");
  if (mode === "overlap" && state.previousSecretExpiresAt && state.previousSecretExpiresAt > now) {
    throw new WebhookSecretRotationConflictError();
  }

  if (mode === "immediate") return createWebhookSecrets(input);

  const expiresAt = new Date(now.getTime() + WEBHOOK_SECRET_OVERLAP_MS);
  const current = readSigningKey(
    input.encryption,
    state.currentSecretCiphertext!,
    getSecretContext(input)
  );

  current.fill(0);
  assertSecretTime(expiresAt);

  const result = createWebhookSecrets(input);

  return {
    secret: result.secret,
    state: {
      ...result.state,
      previousSecretCiphertext: state.currentSecretCiphertext,
      previousSecretExpiresAt: expiresAt
    }
  };
};
// Read active keys for EACH attempt; expired overlap keys are never decrypted.
// Cleanup removes their stored ciphertext. Callers must not cache plaintext keys.
const getWebhookSigningKeys = (input: ReadWebhookSecretsInput): Buffer[] => {
  const { state, now, encryption } = input;
  const context = getSecretContext(input);
  const keys: Buffer[] = [];

  assertSecretTime(now);
  assertSecretState(state);

  try {
    keys.push(readSigningKey(encryption, state.currentSecretCiphertext!, context));

    if (state.previousSecretCiphertext && state.previousSecretExpiresAt! > now) {
      keys.push(readSigningKey(encryption, state.previousSecretCiphertext, context));
    }

    return keys;
  } catch (error) {
    keys.forEach((key) => key.fill(0));
    throw error;
  }
};

export {
  createWebhookSecrets,
  rotateWebhookSecrets,
  getWebhookSigningKeys,
  WebhookSecretRotationConflictError,
  WEBHOOK_SECRET_OVERLAP_MS
};
export type { WebhookSecretOwner, WebhookSecretState, ReadWebhookSecretsInput };
