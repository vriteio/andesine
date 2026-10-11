import { redis } from "#backend/lib/adapters/redis";
import { getConsentWorkspaceKey } from "#backend/lib/auth/consent-workspace";

const clearConsentWorkspace = async (sessionID: string): Promise<void> => {
  await redis.del(getConsentWorkspaceKey(sessionID));
};

export { clearConsentWorkspace };
