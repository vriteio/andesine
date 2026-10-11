import { permissionType } from "../entities/roles";
import { keyPermissionType } from "../entities/keys";
import { userProfileType } from "../entities/users";
import { id } from "../primitives/id";
import * as z from "zod";
import { deviceRequestStateType, deviceUserCodeType } from "../auth/device";
import { baseContract, sessionContract } from "./base";

const identityType = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("key"),
    keyID: id(),
    workspaceID: id(),
    permissions: z.array(keyPermissionType).describe("Permissions of the API key")
  }),
  z.object({
    type: z.enum(["oauth", "session"]),
    user: userProfileType,
    scopes: z.array(z.string()).optional().describe("Scopes of an MCP client's access token"),
    workspaceID: id().optional().describe("Workspace that an MCP client's access token is for"),
    client: z
      .object({ id: z.string(), name: z.string() })
      .optional()
      .describe("The OAuth client of the access token, with the name it registered")
  })
]);
const connectedAppType = z.object({
  clientID: z.string().describe("OAuth client ID of the application"),
  name: z.string().describe("Name of the application, set by the application itself"),
  type: z.enum(["cli", "mcp"]).describe("The Andesine CLI, or an MCP client"),
  workspaces: z
    .array(z.object({ id: id(), name: z.string() }))
    .describe("Workspaces an MCP client can access; the CLI can access all of them"),
  scopes: z.array(z.string()).describe("Granted scopes"),
  connectedAt: z.iso.datetime().describe("When access was first granted"),
  lastUsedAt: z.iso.datetime().nullable().describe("When the application last got a token")
});

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
  listConnectedApps: deviceContract.output(z.array(connectedAppType)),
  revokeConnectedApp: deviceContract.input(z.object({ clientID: z.string() })),
  getIdentity: baseContract
    .route({
      method: "GET",
      path: "/identity",
      summary: "Get credential identity",
      description:
        "Returns the authenticated user for OAuth or browser credentials, or the key and workspace IDs and the permissions of an API key. Does not require a workspace selection and does not count toward API usage.",
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
