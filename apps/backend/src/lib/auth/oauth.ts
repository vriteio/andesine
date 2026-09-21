import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import {
  DEVICE_CODE_GRANT_TYPE,
  getOAuthProviderApi,
  oauthDeviceAuthorization,
  oauthProvider
} from "@better-auth/oauth-provider";
import * as z from "zod";
import type { BetterAuthPlugin } from "better-auth";

interface OAuthURLs {
  apiURL: string;
  appURL: string;
}

const CLI_CLIENT_ID = "andesine-cli";
const CLI_SCOPES = ["andesine:api", "offline_access"];
const CLI_GRANTS = [DEVICE_CODE_GRANT_TYPE, "refresh_token"];
const OAUTH_ACCESS_TOKEN_SECONDS = 15 * 60;
const OAUTH_REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_DISABLED_PATHS = [
  "/device/token",
  "/oauth2/authorize",
  "/oauth2/consent",
  "/oauth2/continue",
  "/oauth2/register",
  "/oauth2/end-session",
  "/oauth2/userinfo"
];

/** Create the provider without importing application adapters or opening connections. */
const createOAuthPlugins = ({ apiURL, appURL }: OAuthURLs) => {
  const provider = oauthProvider({
    loginPage: `${appURL}/auth`,
    consentPage: `${appURL}/auth/device`,
    disableJwtPlugin: true,
    // Upstream requires authorization_code for refresh support. The CLI client
    // excludes that grant, and the authorization endpoints are disabled.
    grantTypes: ["authorization_code", "refresh_token"],
    scopes: CLI_SCOPES,
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
    allowDynamicClientRegistration: false,
    allowUnauthenticatedClientRegistration: false,
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
      verifyCLIAccessToken: createAuthEndpoint(
        {
          method: "POST",
          body: z.object({ token: z.string().startsWith("and_at_") })
        },
        async (context) => {
          const claims = await getOAuthProviderApi(
            context,
            provider.options
          ).requireActiveAccessToken(context.body.token, CLI_CLIENT_ID);
          const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
          const scopes = typeof claims.scope === "string" ? claims.scope.split(" ") : [];
          const validToken =
            claims.iss === context.context.baseURL &&
            audiences.includes(apiURL) &&
            claims.client_id === CLI_CLIENT_ID &&
            typeof claims.sub === "string" &&
            typeof claims.exp === "number" &&
            claims.exp > Date.now() / 1000 &&
            claims.token_type === "Bearer" &&
            !claims.cnf;

          if (!validToken) {
            throw new APIError("UNAUTHORIZED", { message: "Invalid OAuth access token" });
          }

          if (!scopes.includes("andesine:api")) {
            throw new APIError("FORBIDDEN", {
              message: "The access token requires andesine:api scope"
            });
          }

          return { userID: claims.sub!, clientID: CLI_CLIENT_ID };
        }
      )
    },
    hooks: {
      before: [
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
      ]
    }
  } satisfies BetterAuthPlugin;

  return [provider, device, policy] as const;
};

export {
  createOAuthPlugins,
  CLI_CLIENT_ID,
  CLI_SCOPES,
  CLI_GRANTS,
  OAUTH_DISABLED_PATHS,
  OAUTH_ACCESS_TOKEN_SECONDS,
  OAUTH_REFRESH_TOKEN_SECONDS
};
