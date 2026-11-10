import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "../../packages/private/server/src/database/asset-uploads.ts",
    "../../packages/private/server/src/database/assets.ts",
    "../../packages/private/server/src/database/auth.ts",
    "../../packages/private/server/src/database/oauth.ts",
    "../../packages/private/server/src/database/outbound-events.ts",
    "../../packages/private/server/src/database/outbound-deliveries.ts",
    "../../packages/private/server/src/database/collections.ts",
    "../../packages/private/server/src/database/content-schemas.ts",
    "../../packages/private/server/src/database/contents.ts",
    "../../packages/private/server/src/database/stripe-webhook-events.ts",
    "../../packages/private/server/src/database/entries.ts",
    "../../packages/private/server/src/database/groups.ts",
    "../../packages/private/server/src/database/invitations.ts",
    "../../packages/private/server/src/database/keys.ts",
    "../../packages/private/server/src/database/memberships.ts",
    "../../packages/private/server/src/database/publishing.ts",
    "../../packages/private/server/src/database/roles.ts",
    "../../packages/private/server/src/database/usage.ts",
    "../../packages/private/server/src/database/users.ts",
    "../../packages/private/server/src/database/versions.ts",
    "../../packages/private/server/src/database/version-properties.ts",
    "../../packages/private/server/src/database/workspaces.ts",
    "../../packages/private/server/src/database/webhooks.ts",
    "../../packages/private/server/src/database/extensions.ts"
  ],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://andesine:andesine@localhost:5432/andesine"
  },
  strict: true,
  verbose: true
});
