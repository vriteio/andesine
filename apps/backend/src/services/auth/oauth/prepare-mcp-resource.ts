import {
  oauthClientResources,
  oauthClients,
  oauthResources,
  workspaces
} from "@andesine/server/database";
import {
  CLI_CLIENT_ID,
  MCP_SCOPES,
  OAUTH_ACCESS_TOKEN_SECONDS,
  OAUTH_REFRESH_TOKEN_SECONDS,
  isMCPResource,
  parseMCPResource
} from "#backend/lib/auth/oauth";
import { db } from "#backend/lib/adapters/postgres";
import { config } from "#backend/lib/config";
import { toUUID } from "@andesine/contracts/primitives";
import { and, eq, isNull } from "drizzle-orm";

interface PrepareMCPResourceInput {
  resource: string;
  clientID: string;
}

/**
 * Creates the OAuth resource of an MCP URL (fixed or a workspace's) and links an MCP client to it,
 * because resources must exist before authorization. Consent and membership still decide access.
 */
const prepareMCPResource = async (input: PrepareMCPResourceInput): Promise<void> => {
  const workspaceID = parseMCPResource(config.PUBLIC_API_URL, input.resource);
  const supported = isMCPResource(config.PUBLIC_API_URL, input.resource);

  if (!supported || input.clientID === CLI_CLIENT_ID) return;

  const [workspace] = workspaceID
    ? await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, toUUID(workspaceID)), isNull(workspaces.deletingAt)))
    : [{ id: null }];
  const [client] = await db
    .select({ clientId: oauthClients.clientId })
    .from(oauthClients)
    .where(eq(oauthClients.clientId, input.clientID));

  if (!workspace || !client) return;

  const now = new Date();

  await db
    .insert(oauthResources)
    .values({
      identifier: input.resource,
      name: "Andesine MCP",
      allowedScopes: MCP_SCOPES,
      accessTokenTtl: OAUTH_ACCESS_TOKEN_SECONDS,
      refreshTokenTtl: OAUTH_REFRESH_TOKEN_SECONDS,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoNothing();
  await db
    .insert(oauthClientResources)
    .values({ clientId: input.clientID, resourceId: input.resource, createdAt: now })
    .onConflictDoNothing();
};

export { prepareMCPResource };
