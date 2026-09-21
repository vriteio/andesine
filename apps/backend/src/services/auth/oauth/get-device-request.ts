import { auth } from "#backend/lib/adapters/auth";
import { config } from "#backend/lib/config";
import { CLI_CLIENT_ID, CLI_SCOPES } from "#backend/lib/auth/oauth";
import {
  getDeviceRequestState,
  getDeviceRequestErrorState,
  type DeviceRequestState
} from "#backend/lib/auth/device-request";
import { assertDeviceRequestAccess } from "#backend/lib/auth/device-request-access";
import type { SessionData } from "#backend/lib/policy";
import { Auth } from "#backend/services/auth";
import { ORPCError } from "@orpc/server";

interface GetDeviceRequestInput {
  auth: SessionData;
  headers: Headers;
  userCode: string;
}

/** Reviewing a request claims its code for this browser account; it does not approve it. */
const getDeviceRequest = async (input: GetDeviceRequestInput) => {
  await assertDeviceRequestAccess(input.auth);

  const identity = await Auth.getIdentity({ auth: input.auth });

  let state: DeviceRequestState;

  if (identity.type !== "session") throw new ORPCError("FORBIDDEN");

  try {
    const details = await auth.api.deviceVerify({
      headers: input.headers,
      query: { user_code: input.userCode }
    });

    state = getDeviceRequestState(details, {
      clientID: CLI_CLIENT_ID,
      scopes: CLI_SCOPES,
      resource: config.PUBLIC_API_URL
    });
  } catch (error) {
    state = getDeviceRequestErrorState(error);
  }

  return { state, userCode: input.userCode, user: identity.user, resource: config.PUBLIC_API_URL };
};

export { getDeviceRequest };
