import { deleteUser } from "./delete-user";
import { getSessionData } from "./get-session-data";
import { prepareAccountDeletion } from "./prepare-account-deletion";
import { invalidateSessionData } from "./invalidate-session-data";
import { OAuth } from "./oauth";

import { getIdentity } from "./get-identity";
import { verifyExtensionAppToken } from "./verify-extension-app-token";

const Auth = {
  deleteUser,
  getIdentity,
  verifyExtensionAppToken,
  OAuth,
  getSessionData,
  prepareAccountDeletion,
  invalidateSessionData
};

export { Auth };
export type { SessionData } from "#backend/lib/policy";
