import { auth } from "#backend/lib/adapters/auth";
import {
  getDeviceRequestErrorState,
  type DeviceRequestState
} from "#backend/lib/auth/device-request";
import type { SessionData } from "#backend/lib/policy";
import { Auth } from "#backend/services/auth";
import { ORPCError } from "@orpc/server";

interface RespondToDeviceRequestInput {
  auth: SessionData;
  headers: Headers;
  userCode: string;
  userID: string;
  decision: "approve" | "deny";
}

const respondToDeviceRequest = async (
  input: RespondToDeviceRequestInput
): Promise<{ state: DeviceRequestState }> => {
  if (input.auth.type !== "session" || !input.auth.session) throw new ORPCError("FORBIDDEN");
  if (input.auth.session.userID !== input.userID) return { state: "account-mismatch" };

  const request = await Auth.OAuth.getDeviceRequest(input);

  if (request.state !== "pending") return { state: request.state };

  try {
    const options = { headers: input.headers, body: { userCode: input.userCode } };

    if (input.decision === "approve") {
      await auth.api.deviceApprove(options);
      return { state: "approved" };
    }

    await auth.api.deviceDeny(options);
    return { state: "denied" };
  } catch (error) {
    return { state: getDeviceRequestErrorState(error) };
  }
};

export { respondToDeviceRequest };
