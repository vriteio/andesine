import { permissionType, userProfileType } from "#backend/db";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { deviceRequestStateType, deviceUserCodeType } from "#backend/lib/auth/device-request";
import { baseContract, sessionContract } from "./base";

const identityType = z.discriminatedUnion("type", [
  z.object({ type: z.literal("key"), keyID: id(), workspaceID: id() }),
  z.object({ type: z.enum(["oauth", "session"]), user: userProfileType })
]);

const deviceContract = sessionContract.meta({ requireWorkspace: false, trackUsage: false });
const authContract = baseContract.router({
  getDeviceRequest: deviceContract.input(z.object({ userCode: deviceUserCodeType })).output(
    z.object({
      state: deviceRequestStateType,
      userCode: z.string(),
      user: userProfileType,
      resource: z.string()
    })
  ),
  respondToDeviceRequest: deviceContract
    .input(
      z.object({
        userCode: deviceUserCodeType,
        userID: id(),
        decision: z.enum(["approve", "deny"])
      })
    )
    .output(z.object({ state: deviceRequestStateType })),
  getIdentity: baseContract
    .route({
      method: "GET",
      path: "/identity",
      summary: "Get credential identity",
      description:
        "Returns the authenticated user for OAuth or browser credentials, or the key and workspace IDs for an API key. Does not require a workspace selection and does not count toward API usage.",
      tags: ["auth"]
    })
    .meta({
      required: { session: true, oauth: true, key: true },
      requireWorkspace: false,
      trackUsage: false
    })
    .output(identityType),
  session: baseContract
    .route({
      method: "GET",
      path: "/session"
    })
    .meta({
      required: {
        session: true
      }
    })
    .output(
      z.object({
        workspaceID: id(),
        subscriptionPlan: z.string(),
        memberID: id(),
        userID: id(),
        roleID: id(),
        permissions: z.array(permissionType),
        admin: z.boolean()
      })
    ),
  verifyOTPToken: baseContract
    .input(
      z.object({
        token: z.string()
      })
    )
    .output(
      z.object({
        email: z.email(),
        otp: z.string().length(6)
      })
    )
});

export { authContract, identityType };
