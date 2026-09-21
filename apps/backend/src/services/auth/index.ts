import { getSessionData } from "./get-session-data";
import { invalidateSessionData } from "./invalidate-session-data";
import { OAuth } from "./oauth";

import { getIdentity } from "./get-identity";

const Auth = {
  getIdentity,
  OAuth,
  getSessionData,
  invalidateSessionData
};

export { Auth };
export type { SessionData } from "#backend/lib/policy";
