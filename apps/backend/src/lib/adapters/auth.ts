import { schema } from "@andesine/server/database";
import { Asset } from "#backend/services/assets";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP, multiSession } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { toUserID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { db } from "./postgres";
import { config } from "#backend/lib/config";
import { sendEmail } from "./email";
import { Workspaces } from "#backend/services/workspaces";
import { incrementWithExpiry, redis } from "./redis";
import { createOTPToken, RATE_LIMITS } from "#backend/lib/security";
import { add } from "date-fns";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { createOAuthPlugins, OAUTH_DISABLED_PATHS } from "#backend/lib/auth/oauth";
import { Auth } from "#backend/services/auth";
import { capture } from "#backend/lib/analytics";

interface AuthHookContext {
  path?: string;
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

const OTP_EXPIRY_SECONDS = 300;
// A new review code is the same code, so failed guesses are limited, per client IP.
const REVIEW_ACCOUNT_FAILURES = 10;
const REVIEW_ACCOUNT_FAILURES_SECONDS = 60 * 60;
const OTP_VERIFICATION_PATHS = [
  "/sign-in/email-otp",
  "/email-otp/verify-email",
  "/email-otp/check-verification-otp"
];

// Sign-ups also create a session; their requests don't count as sign-ins.
const signUpContexts = new WeakSet<object>();

const getAuthMethod = (context: AuthHookContext | null): string | undefined => {
  const path = context?.path ?? "";
  const provider = context?.body?.provider;

  if (path === "/callback/:id") return context?.params?.id;
  if (path === "/sign-in/social" && typeof provider === "string") return provider;
  if (path.startsWith("/passkey/")) return "passkey";

  return path.includes("email-otp") ? "email" : path || undefined;
};
// Directory reviewers can't receive email codes, so their account has a fixed code.
const isReviewAccount = (email: string): boolean => {
  const reviewEmail = config.REVIEW_ACCOUNT_EMAIL?.toLowerCase();

  return Boolean(reviewEmail && config.REVIEW_ACCOUNT_CODE) && email.toLowerCase() === reviewEmail;
};

const getReviewFailuresKey = (headers: Headers | undefined): string => {
  return `review-account-failures:${headers?.get("x-client-ip") ?? "unknown"}`;
};
const isReviewAccountRequest = (body: unknown): boolean => {
  const email = (body as { email?: unknown } | undefined)?.email;

  return typeof email === "string" && isReviewAccount(email);
};

const auth = betterAuth({
  appName: "Andesine",
  baseURL: config.PUBLIC_API_URL,
  secret: config.SECRET,
  basePath: "/auth",
  disabledPaths: [
    ...OAUTH_DISABLED_PATHS,
    // Email + password (authentication is entirely passwordless, so these are unsupported)
    "/sign-up/email",
    "/sign-in/email",
    "/request-password-reset",
    "/reset-password/:token",
    "/reset-password",
    "/email-otp/request-password-reset",
    "/forget-password/email-otp",
    "/email-otp/reset-password",
    // Password management (to be implemented in the future)
    "/verify-password",
    "/change-password",
    // Account email changes (to be implemented in the future)
    "/change-email",
    "/email-otp/request-email-change",
    "/email-otp/change-email"
  ],
  logger: { level: config.NODE_ENV === "production" ? "error" : "debug" },
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    ...RATE_LIMITS.authentication,
    customRules: {
      "/sign-in/*": RATE_LIMITS.signIn,
      "/device/code": RATE_LIMITS.oauthDevice,
      "/device": RATE_LIMITS.oauthDevice,
      "/device/approve": RATE_LIMITS.oauthDevice,
      "/device/deny": RATE_LIMITS.oauthDevice,
      "/oauth2/token": RATE_LIMITS.oauthToken,
      "/email-otp/*": RATE_LIMITS.otp
    }
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
    transaction: true
  }),
  trustedOrigins: [config.PUBLIC_APP_URL, config.PUBLIC_API_URL],
  advanced: {
    database: {
      generateId: "uuid"
    },
    ipAddress: {
      ipAddressHeaders: ["x-client-ip"]
    },
    ...(config.PUBLIC_COOKIE_DOMAIN && {
      crossSubDomainCookies: {
        enabled: true,
        domain: config.PUBLIC_COOKIE_DOMAIN
      }
    })
  },
  secondaryStorage: {
    get: async (key) => {
      return await redis.get(`auth:${key}`);
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        await redis.set(`auth:${key}`, value, { EX: ttl });
      } else {
        await redis.set(`auth:${key}`, value);
      }
    },
    delete: async (key) => {
      await redis.del(`auth:${key}`);
    },
    getAndDelete: async (key) => {
      return await redis.getDel(`auth:${key}`);
    },
    increment: async (key, ttl) => {
      const result = await incrementWithExpiry(redis, `auth:${key}`, ttl);

      return result.count;
    }
  },
  session: {
    storeSessionInDatabase: true
  },
  verification: {
    storeInDatabase: true
  },
  socialProviders: {
    google: {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET
    },
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET
    }
  },
  user: {
    additionalFields: {
      currentWorkspaceID: {
        type: "string",
        required: false,
        transform: {
          input: (value) => {
            if (!value) return null;

            return toUUID(value as string) as unknown as string;
          },
          output: (value) => {
            if (!value) return null;

            return toWorkspaceID(value as string);
          }
        }
      }
    }
  },
  databaseHooks: {
    user: {
      delete: {
        before: async (user) => {
          await Asset.Profile.deleteUser({ userID: toUserID(user.id) });
        }
      },
      create: {
        before: async (user) => {
          // Ensure the name is at most 320 chars
          const name = (user.name || user.email.split("@")[0]).slice(0, 320);

          return {
            data: {
              ...user,
              name
            }
          };
        },
        after: async (user, context) => {
          if (context) signUpContexts.add(context);

          capture("user_signed_up", {
            userID: toUserID(user.id),
            properties: { method: getAuthMethod(context) }
          });

          try {
            const defaultWorkspaceName = `${user.name} (Personal Workspace)`;
            const workspaceName =
              defaultWorkspaceName.length > 50 ? "Personal Workspace" : defaultWorkspaceName;
            const workspace = await Workspaces.create({
              name: workspaceName,
              userID: toUserID(user.id)
            });

            // Update the user's currentWorkspaceID to the newly created workspace before returning the user object
            await context?.context.internalAdapter.updateUser(user.id, {
              currentWorkspaceID: toUUID(workspace.id)
            });
          } catch (error) {
            console.error("Failed to provision workspace", {
              userID: user.id,
              error
            });
          }
        }
      }
    },
    session: {
      create: {
        after: async (session, context) => {
          if (context && signUpContexts.has(context)) return;

          capture("user_signed_in", {
            userID: toUserID(session.userId),
            properties: { method: getAuthMethod(context) }
          });
        }
      }
    }
  },
  emailVerification: { autoSignInAfterVerification: true },
  plugins: [
    ...createOAuthPlugins({
      apiURL: config.PUBLIC_API_URL,
      appURL: config.PUBLIC_APP_URL,
      // Read when called: services/auth imports this module, so Auth isn't ready at load time.
      prepareMCPResource: (input) => Auth.OAuth.prepareMCPResource(input),
      consentWorkspace: {
        select: (input) => {
          return Auth.OAuth.selectConsentWorkspace({ ...input, userID: toUserID(input.userID) });
        },
        get: (sessionID) => Auth.OAuth.getConsentWorkspace(sessionID),
        clear: (sessionID) => Auth.OAuth.clearConsentWorkspace(sessionID)
      }
    }),
    {
      id: "andesine-review-account",
      hooks: {
        before: [
          {
            matcher: (context) => OTP_VERIFICATION_PATHS.includes(context.path ?? ""),
            handler: createAuthMiddleware(async (context) => {
              if (!isReviewAccountRequest(context.body)) return;

              const failures = Number(await redis.get(getReviewFailuresKey(context.headers)));

              if (failures >= REVIEW_ACCOUNT_FAILURES) {
                throw APIError.fromStatus("TOO_MANY_REQUESTS", {
                  message: "Too many sign-in attempts"
                });
              }
            })
          }
        ],
        after: [
          {
            matcher: (context) => OTP_VERIFICATION_PATHS.includes(context.path ?? ""),
            handler: createAuthMiddleware(async (context) => {
              const failed = isAPIError(context.context.returned);

              if (!failed || !isReviewAccountRequest(context.body)) return;

              await incrementWithExpiry(
                redis,
                getReviewFailuresKey(context.headers),
                REVIEW_ACCOUNT_FAILURES_SECONDS
              );
            })
          }
        ]
      }
    },
    {
      id: "andesine-oauth-client",
      init: async (): Promise<void> => {
        await Auth.OAuth.provision();
      }
    },
    emailOTP({
      generateOTP: ({ email }) => (isReviewAccount(email) ? config.REVIEW_ACCOUNT_CODE : undefined),
      async sendVerificationOTP({ email, otp, type }, ctx) {
        if (type === "forget-password" || type === "change-email") {
          throw APIError.fromStatus("BAD_REQUEST", { message: "Unsupported OTP type" });
        }

        if (isReviewAccount(email)) return;

        const headers = ctx?.headers || ctx?.request?.headers;
        const sessionVerification = headers?.get("x-session-verification") === "true";
        const sessionVerificationCallback = headers?.get("x-session-verification-callback");
        const otpToken = createOTPToken({
          email,
          otp,
          type,
          expiresAt: add(new Date(), { seconds: OTP_EXPIRY_SECONDS })
        });

        if (sessionVerification) {
          const query = new URLSearchParams({
            mode: "sign-in",
            token: otpToken,
            addAccount: "true",
            redirectTo: sessionVerificationCallback || "/"
          });

          // Avoid await to prevent timing attacks
          void sendEmail(email, "session-verification", {
            code: otp,
            link: `${config.PUBLIC_APP_URL}/auth/email?${query}`
          });

          return;
        }

        // Avoid await to prevent timing attacks
        await sendEmail(email, "verification-otp", {
          code: otp,
          type,
          link: `${config.PUBLIC_APP_URL}/auth/email?mode=${type === "email-verification" ? "sign-in" : "sign-up"}&token=${otpToken}`
        });
      },
      storeOTP: "hashed",
      otpLength: 6,
      expiresIn: OTP_EXPIRY_SECONDS,
      disableSignUp: false,
      rateLimit: RATE_LIMITS.otp
    }),
    passkey({
      rpName: "Andesine",
      rpID: config.PASSKEY_RP_ID,
      origin: config.PASSKEY_ORIGIN
    }),
    multiSession()
  ]
});

export { auth };
export type { auth as Auth };
