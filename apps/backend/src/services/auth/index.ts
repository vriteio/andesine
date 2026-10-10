import { getSessionData } from "./get-session-data";
import { invalidateSessionData } from "./invalidate-session-data";
import { OAuth } from "./oauth";

import { getIdentity } from "./get-identity";
import { verifyExtensionAppToken } from "./verify-extension-app-token";

const Auth = {
  getIdentity,
  verifyExtensionAppToken,
  OAuth,
  getSessionData,
  invalidateSessionData
};

export { Auth };
export type { SessionData } from "#backend/lib/policy";
