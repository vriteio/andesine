import { versionRetentionConfigSchema } from "@andesine/server/versioning/config";
import { searchConfigSchema } from "@andesine/server/search/config";
import { assetConfigSchema } from "@andesine/server/assets/config";
import { encryptionConfigSchema } from "@andesine/server/security/config";
import { webhookDestinationConfigSchema } from "@andesine/server/webhooks/destination/config";
import { billingConfigSchema } from "#backend/lib/billing/config-schema";
import * as z from "zod";

const cookieDomain = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;

    return value.trim().toLowerCase().replace(/^\.+/, "") || undefined;
  },
  z
    .string()
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/
    )
    .optional()
);
const secret = z.string().trim().min(32, "SECRET must contain at least 32 characters");
const configSchema = billingConfigSchema.safeExtend({
  NODE_ENV: z.string().optional().describe("Node environment"),
  // Hosts
  PUBLIC_API_HOST: z.string().describe("Public host of the API"),
  PUBLIC_APP_HOST: z.string().describe("Public host of the app"),
  PUBLIC_COOKIE_DOMAIN: cookieDomain.describe(
    "Domain to set for cookies in cross-subdomain setups"
  ),
  PUBLIC_SECURE: z
    .stringbool()
    .optional()
    .describe("Whether to use secure connections for public URLs"),
  // Secrets
  SECRET: secret.describe("Secret for signing tokens and encrypting data"),
  ...encryptionConfigSchema.shape,
  ...webhookDestinationConfigSchema.shape,
  // Database
  DATABASE_URL: z.string().describe("PostgreSQL connection URL"),
  QUEUE_REDIS_URL: z.string().describe("Background job Redis connection URL"),
  REDIS_URL: z.string().describe("Redis connection URL"),
  // Search
  ...searchConfigSchema.shape,
  // Email
  SENDER_EMAIL: z.string().describe("Email address to send emails from"),
  SENDER_NAME: z.string().describe("Name to send emails from"),
  // UserCheck
  USER_CHECK: z
    .union([z.stringbool(), z.string()])
    .optional()
    .describe("UserCheck configuration (`true` or API key to enable)"),
  // Resend
  RESEND_API_KEY: z.string().optional().describe("Resend API key"),
  // SMTP
  SMTP_HOST: z.string().optional().describe("SMTP host for sending emails"),
  SMTP_PORT: z.coerce.number().optional().describe("SMTP port for sending emails"),
  SMTP_USERNAME: z.string().optional().describe("SMTP username for sending emails"),
  SMTP_PASSWORD: z.string().optional().describe("SMTP password for sending emails"),
  SMTP_SECURE: z.stringbool().optional().describe("Use secure connection for SMTP"),
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1).describe("Google OAuth client ID"),
  GOOGLE_CLIENT_SECRET: z.string().min(1).describe("Google OAuth client secret"),
  // GitHub App
  GITHUB_CLIENT_ID: z.string().min(1).describe("GitHub OAuth client ID"),
  GITHUB_CLIENT_SECRET: z.string().min(1).describe("GitHub OAuth client secret"),
  // Passkeys (WebAuthn)
  PASSKEY_RP_ID: z.string().optional().describe("WebAuthn Relying Party ID"),
  PASSKEY_ORIGIN: z.string().optional().describe("WebAuthn expected origin"),
  // Version retention
  ...versionRetentionConfigSchema.shape,
  ...assetConfigSchema.shape
});

export { configSchema };
