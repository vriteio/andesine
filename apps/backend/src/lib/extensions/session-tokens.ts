import { redis } from "#backend/lib/adapters";
import { createHash, randomBytes } from "node:crypto";

interface StoredExtensionSession {
  extensionID: string;
  workspaceID: string;
  membershipID: string;
  userID: string;
  version: string;
  generation: number;
}
interface IssuedSessionToken {
  token: string;
  expiresAt: string;
}

const EXTENSION_SESSION_TTL_SECONDS = 600;
const TOKEN_PREFIX = "and_es_";

// Only the hash is stored; the token itself goes to the extension frontend once.
const getSessionTokenKey = (token: string): string => {
  return `extension-session:${createHash("sha256").update(token).digest("hex")}`;
};
const issueSessionToken = async (session: StoredExtensionSession): Promise<IssuedSessionToken> => {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + EXTENSION_SESSION_TTL_SECONDS * 1000).toISOString();

  await redis.set(getSessionTokenKey(token), JSON.stringify(session), {
    EX: EXTENSION_SESSION_TTL_SECONDS
  });

  return { token, expiresAt };
};

export { EXTENSION_SESSION_TTL_SECONDS, getSessionTokenKey, issueSessionToken };
export type { IssuedSessionToken, StoredExtensionSession };
