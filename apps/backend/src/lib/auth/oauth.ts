import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx
} from "better-auth/api";
import {
  DEVICE_CODE_GRANT_TYPE,
  getOAuthProviderApi,
  oauthDeviceAuthorization,
  oauthProvider
} from "@better-auth/oauth-provider";
import * as z from "zod";
import type { BetterAuthPlugin } from "better-auth";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { CLI_CLIENT_ID } from "@andesine/server/database";

interface ConsentWorkspaceStore {
  /** Checks membership and keeps the picked workspace for the browser session. */
  select: (input: { sessionID: string; userID: string; workspaceID: string }) => Promise<void>;
  get: (sessionID: string) => Promise<string | undefined>;
  clear: (sessionID: string) => Promise<void>;
}
interface OAuthPluginOptions {
  apiURL: string;
  appURL: string;
  prepareMCPResource: (input: { resource: string; clientID: string }) => Promise<void>;
  consentWorkspace: ConsentWorkspaceStore;
}
interface VerifiedAccessToken {
  userID: string;
  clientID: string;
  scopes: string[];
  /** The workspace picked at consent for an MCP token; CLI tokens select it per request. */
  workspaceID?: string;
}

const CLI_SCOPES = ["andesine:api", "offline_access"];
const CLI_GRANTS = [DEVICE_CODE_GRANT_TYPE, "refresh_token"];
const OAUTH_ACCESS_TOKEN_SECONDS = 15 * 60;
const OAUTH_REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const MCP_READ_SCOPE = "andesine:read";
const MCP_WRITE_SCOPE = "andesine:write";
const MCP_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE, "offline_access"];
const OAUTH_DISABLED_PATHS = ["/device/token", "/oauth2/end-session", "/oauth2/userinfo"];
// Matches no consent, so an MCP authorization without a picked workspace asks for consent.
const NO_WORKSPACE = "none";

const getMCPResource = (apiURL: string, workspaceID?: string): string => {
  return workspaceID ? `${apiURL}/mcp/${workspaceID}` : `${apiURL}/mcp`;
};
const parseMCPResource = (apiURL: string, resource: string): string | null => {
  const prefix = `${apiURL}/mcp/`;
  const workspaceID = resource.startsWith(prefix) ? resource.slice(prefix.length) : "";

  return /^ws_[A-Za-z\d]{1,22}$/.test(workspaceID) ? workspaceID : null;
};
const isMCPResource = (apiURL: string, resource: string): boolean => {
  return resource === getMCPResource(apiURL) || parseMCPResource(apiURL, resource) !== null;
};

const isHTTPLoopback = (uri: string): boolean => {
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(uri);
};

/** Create the provider without importing application adapters or opening connections. */
const createOAuthPlugins = (options: OAuthPluginOptions) => {
  const { apiURL, appURL, prepareMCPResource, consentWorkspace } = options;
  const provider = oauthProvider({
    loginPage: `${appURL}/auth/sign-in`,
    consentPage: `${appURL}/auth/connect`,
    // The workspace is picked on the consent page; it becomes the consent's reference ID.
    postLogin: {
      page: `${appURL}/auth/connect`,
      shouldRedirect: () => false,
      consentReferenceId: async ({ session }) => {
        return (session && (await consentWorkspace.get(session.id))) || NO_WORKSPACE;
      }
    },
    customAccessTokenClaims: ({ referenceId }) => {
      return referenceId && referenceId !== NO_WORKSPACE ? { workspace_id: referenceId } : {};
    },
    disableJwtPlugin: true,
    // The CLI client uses the device grant; MCP clients use authorization codes with PKCE.
    grantTypes: ["authorization_code", "refresh_token"],
    scopes: [...CLI_SCOPES, MCP_READ_SCOPE, MCP_WRITE_SCOPE],
    resources: [
      {
        identifier: apiURL,
        name: "Andesine public API",
        allowedScopes: CLI_SCOPES,
        accessTokenTtl: OAUTH_ACCESS_TOKEN_SECONDS,
        refreshTokenTtl: OAUTH_REFRESH_TOKEN_SECONDS
      }
    ],
    enforcePerClientResources: true,
    accessTokenExpiresIn: OAUTH_ACCESS_TOKEN_SECONDS,
    refreshTokenExpiresIn: OAUTH_REFRESH_TOKEN_SECONDS,
    refreshTokenReuseInterval: 0,
    // MCP clients (Claude, ChatGPT) register themselves as public clients.
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationDefaultScopes: MCP_SCOPES,
    clientRegistrationAllowedScopes: MCP_SCOPES,
    clientPrivileges: () => false,
    resourcePrivileges: () => false,
    storeTokens: "hashed",
    prefix: { opaqueAccessToken: "and_at_", refreshToken: "and_rt_" }
  });
  const device = oauthDeviceAuthorization({
    verificationUri: `${appURL}/auth/device`,
    expiresIn: "10m",
    interval: "5s"
  });
  const policy = {
    id: "andesine-oauth-policy",
    endpoints: {
      // No HTTP path: this endpoint is available only through auth.api on the server.
      verifyAccessToken: createAuthEndpoint(
        {
          method: "POST",
          body: z.object({ token: z.string().startsWith("and_at_") })
        },
        async (context): Promise<VerifiedAccessToken> => {
          const claims = await getOAuthProviderApi(
            context,
            provider.options
          ).requireActiveAccessToken(context.body.token);
          const audiences = (Array.isArray(claims.aud) ? claims.aud : [claims.aud]).filter(
            (audience): audience is string => typeof audience === "string"
          );
          const scopes = typeof claims.scope === "string" ? claims.scope.split(" ") : [];
          const validToken =
            claims.iss === context.context.baseURL &&
            typeof claims.client_id === "string" &&
            typeof claims.sub === "string" &&
            typeof claims.exp === "number" &&
            claims.exp > Date.now() / 1000 &&
            claims.token_type === "Bearer" &&
            !claims.cnf;
          const invalidToken = () => {
            return new APIError("UNAUTHORIZED", { message: "Invalid OAuth access token" });
          };

          if (!validToken) throw invalidToken();

          if (claims.client_id === CLI_CLIENT_ID) {
            if (!audiences.includes(apiURL)) throw invalidToken();

            if (!scopes.includes("andesine:api")) {
              throw new APIError("FORBIDDEN", {
                message: "The access token requires andesine:api scope"
              });
            }

            return { userID: claims.sub!, clientID: CLI_CLIENT_ID, scopes };
          }

          // Other clients get MCP tokens for one MCP resource and the workspace picked at consent.
          const resources = audiences.filter((audience) => isMCPResource(apiURL, audience));
          const workspaceID = typeof claims.workspace_id === "string" ? claims.workspace_id : null;
          const resourceWorkspaceID = resources[0] && parseMCPResource(apiURL, resources[0]);
          const hasMCPScope = scopes.includes(MCP_READ_SCOPE) || scopes.includes(MCP_WRITE_SCOPE);
          const validMCPToken =
            resources.length === 1 &&
            workspaceID !== null &&
            (!resourceWorkspaceID || resourceWorkspaceID === workspaceID);

          if (!validMCPToken) throw invalidToken();

          if (!hasMCPScope) {
            throw new APIError("FORBIDDEN", {
              message: `The access token requires ${MCP_READ_SCOPE} or ${MCP_WRITE_SCOPE} scope`
            });
          }

          return {
            userID: claims.sub!,
            clientID: claims.client_id as string,
            scopes,
            workspaceID
          };
        }
      )
    },
    hooks: {
      before: [
        {
          matcher: (context) => context.path === "/oauth2/authorize",
          handler: createAuthMiddleware(async (context) => {
            const input = { ...context.query, ...context.body } as Record<string, unknown>;
            const resources = [input.resource].flat().filter((value) => typeof value === "string");

            if (typeof input.client_id !== "string") return;

            // A client ID metadata document client is created on first use; create it before linking.
            if (input.client_id.startsWith("https://") && resources.length) {
              await getOAuthProviderApi(context, provider.options).getClient(input.client_id);
            }

            for (const resource of resources) {
              if (isMCPResource(apiURL, resource)) {
                await prepareMCPResource({ resource, clientID: input.client_id });
              }
            }
          })
        },
        {
          matcher: (context) => context.path === "/oauth2/consent",
          // An approved MCP consent names its workspace: the picked one, or the one in the URL.
          handler: createAuthMiddleware(async (context) => {
            const body = (context.body ?? {}) as Record<string, unknown>;
            const workspaceID = body.workspace_id;
            const query = new URLSearchParams(String(body.oauth_query ?? ""));
            const resources = query.getAll("resource").filter((resource) => {
              return isMCPResource(apiURL, resource);
            });
            const session = await getSessionFromCtx(context);
            const invalidWorkspace = (description: string) => {
              return new APIError("BAD_REQUEST", {
                error: "invalid_request",
                error_description: description
              });
            };

            const approvesMCPResource = body.accept === true && resources.length > 0 && session;

            if (!approvesMCPResource) return;

            if (typeof workspaceID !== "string") throw invalidWorkspace("Pick a workspace.");

            const otherWorkspace = resources.some((resource) => {
              const resourceWorkspaceID = parseMCPResource(apiURL, resource);

              return resourceWorkspaceID !== null && resourceWorkspaceID !== workspaceID;
            });

            if (otherWorkspace) throw invalidWorkspace("The workspace doesn't match the MCP URL.");

            await consentWorkspace.select({
              sessionID: session.session.id,
              userID: session.user.id,
              workspaceID
            });
          })
        },
        {
          matcher: (context) => context.path === "/oauth2/register",
          // Local clients (Claude Code, MCP Inspector) register loopback redirects without a type.
          handler: createAuthMiddleware(async (context) => {
            const body = context.body as Record<string, unknown> | undefined;
            const redirectURIs = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
            const loopbackOnly =
              redirectURIs.length > 0 &&
              redirectURIs.every((uri) => typeof uri === "string" && isHTTPLoopback(uri));

            const untypedLoopbackClient = body?.application_type === undefined && loopbackOnly;

            if (!body || !untypedLoopbackClient) return;

            return { context: { body: { ...body, application_type: "native" } } };
          })
        },
        {
          matcher: (context) => context.path === "/device/code",
          handler: createAuthMiddleware(async (context) => {
            const body = context.body;
            const scopes = typeof body?.scope === "string" ? body.scope.trim().split(/\s+/) : [];
            const hasExpectedScopes =
              scopes.length === CLI_SCOPES.length &&
              CLI_SCOPES.every((scope) => scopes.includes(scope));

            if (body?.client_id !== CLI_CLIENT_ID || body?.user_id !== undefined) {
              throw new APIError("BAD_REQUEST", {
                error: "invalid_request",
                error_description: "Use the Andesine CLI client without a pre-bound user."
              });
            }

            if (!hasExpectedScopes) {
              throw new APIError("BAD_REQUEST", {
                error: "invalid_scope",
                error_description: "Request andesine:api and offline_access."
              });
            }

            if (body?.resource !== apiURL) {
              throw new APIError("BAD_REQUEST", {
                error: "invalid_target",
                error_description: "The resource must be this instance's API URL."
              });
            }
          })
        }
      ],
      after: [
        {
          matcher: (context) => context.path === "/oauth2/consent",
          // Each authorization picks its workspace again; the choice served only this consent.
          handler: createAuthMiddleware(async (context) => {
            const session = await getSessionFromCtx(context);

            if (session) await consentWorkspace.clear(session.session.id);
          })
        },
        {
          matcher: (context) => context.path === "/oauth2/token",
          // Grants outlive the browser session that approved them; expiry and revocation end them.
          handler: createAuthMiddleware(async (context) => {
            const returned = context.context.returned as Record<string, unknown> | undefined;
            const api = getOAuthProviderApi(context, provider.options);
            const tokens = [
              { model: "oauthAccessToken", value: returned?.access_token, prefix: "and_at_" },
              { model: "oauthRefreshToken", value: returned?.refresh_token, prefix: "and_rt_" }
            ];

            for (const { model, value, prefix } of tokens) {
              if (typeof value !== "string" || !value.startsWith(prefix)) continue;

              const type = model === "oauthAccessToken" ? "access_token" : "refresh_token";

              await context.context.adapter.update({
                model,
                where: [
                  { field: "token", value: await api.hashToken(value.slice(prefix.length), type) }
                ],
                update: { sessionId: null }
              });
            }
          })
        }
      ]
    }
  } satisfies BetterAuthPlugin;

  // HTTPS client IDs (ChatGPT, Smithery) need no registration; the Node transport blocks SSRF.
  const clientMetadataDocuments = cimd({
    fetchClientMetadataResource,
    metadataProfile: "mcp-2026-07-28"
  });

  return [provider, device, clientMetadataDocuments, policy] as const;
};

export {
  createOAuthPlugins,
  getMCPResource,
  isMCPResource,
  parseMCPResource,
  CLI_CLIENT_ID,
  MCP_READ_SCOPE,
  MCP_SCOPES,
  MCP_WRITE_SCOPE,
  CLI_SCOPES,
  CLI_GRANTS,
  OAUTH_DISABLED_PATHS,
  OAUTH_ACCESS_TOKEN_SECONDS,
  OAUTH_REFRESH_TOKEN_SECONDS
};
export type { VerifiedAccessToken };
