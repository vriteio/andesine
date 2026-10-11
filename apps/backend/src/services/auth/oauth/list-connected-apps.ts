import {
  memberships,
  oauthAccessTokens,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  workspaces
} from "@andesine/server/database";
import { CLI_CLIENT_ID, parseMCPResource } from "#backend/lib/auth/oauth";
import { db } from "#backend/lib/adapters/postgres";
import { config } from "#backend/lib/config";
import { toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, eq, gt, inArray, isNull, max } from "drizzle-orm";

interface Grant {
  clientID: string;
  /** The workspace picked at consent. */
  referenceID: string | null;
  resources: string[] | null;
  scopes: string[];
  createdAt: Date;
}
interface ListConnectedAppsInput {
  userID: string;
}
interface ConnectedApp {
  clientID: string;
  name: string;
  type: "cli" | "mcp";
  workspaces: Array<{ id: string; name: string }>;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
}

const getWorkspaceIDs = (grants: Grant[]): string[] => {
  const workspaceIDs = grants.flatMap(({ referenceID, resources }) => {
    const resourceWorkspaceIDs = (resources ?? []).flatMap((resource) => {
      return parseMCPResource(config.PUBLIC_API_URL, resource) ?? [];
    });

    return referenceID?.startsWith("ws_")
      ? [referenceID, ...resourceWorkspaceIDs]
      : resourceWorkspaceIDs;
  });

  return [...new Set(workspaceIDs)];
};

/** Lists applications with a consent or an active token: MCP clients and the CLI. */
const listConnectedApps = async (input: ListConnectedAppsInput): Promise<ConnectedApp[]> => {
  const userID = toUUID(input.userID);
  const now = new Date();
  const grantColumns = (table: typeof oauthRefreshTokens | typeof oauthAccessTokens) => ({
    clientID: table.clientId,
    referenceID: table.referenceId,
    resources: table.resources,
    scopes: table.scopes,
    createdAt: table.createdAt
  });
  const activeToken = (table: typeof oauthRefreshTokens | typeof oauthAccessTokens) => {
    return and(eq(table.userId, userID), isNull(table.revoked), gt(table.expiresAt, now));
  };
  const [consents, refreshTokens, accessTokens, lastUses] = await Promise.all([
    db
      .select({
        clientID: oauthConsents.clientId,
        referenceID: oauthConsents.referenceId,
        resources: oauthConsents.resources,
        scopes: oauthConsents.scopes,
        createdAt: oauthConsents.createdAt
      })
      .from(oauthConsents)
      .where(eq(oauthConsents.userId, userID)),
    db
      .select(grantColumns(oauthRefreshTokens))
      .from(oauthRefreshTokens)
      .where(activeToken(oauthRefreshTokens)),
    db
      .select(grantColumns(oauthAccessTokens))
      .from(oauthAccessTokens)
      .where(activeToken(oauthAccessTokens)),
    db
      .select({ clientID: oauthAccessTokens.clientId, usedAt: max(oauthAccessTokens.createdAt) })
      .from(oauthAccessTokens)
      .where(eq(oauthAccessTokens.userId, userID))
      .groupBy(oauthAccessTokens.clientId)
  ]);
  const grants: Grant[] = [...consents, ...refreshTokens, ...accessTokens];
  const clientIDs = [...new Set(grants.map(({ clientID }) => clientID))];
  const workspaceIDs = getWorkspaceIDs(grants);

  if (!clientIDs.length) return [];

  const [clients, memberWorkspaces] = await Promise.all([
    db
      .select({ clientID: oauthClients.clientId, name: oauthClients.name })
      .from(oauthClients)
      .where(inArray(oauthClients.clientId, clientIDs)),
    workspaceIDs.length
      ? db
          .select({ id: workspaces.id, name: workspaces.name })
          .from(workspaces)
          .innerJoin(memberships, eq(memberships.workspaceID, workspaces.id))
          .where(
            and(
              inArray(workspaces.id, workspaceIDs.map(toUUID)),
              eq(memberships.userID, userID),
              isNull(workspaces.deletingAt)
            )
          )
      : []
  ]);

  return clientIDs
    .map((clientID): ConnectedApp => {
      const clientGrants = grants.filter((grant) => grant.clientID === clientID);
      const clientWorkspaceIDs = getWorkspaceIDs(clientGrants);
      const usedAt = lastUses.find((use) => use.clientID === clientID)?.usedAt;
      const createdAt = Math.min(...clientGrants.map(({ createdAt }) => createdAt.getTime()));
      const isCLI = clientID === CLI_CLIENT_ID;

      return {
        clientID,
        name: clients.find((client) => client.clientID === clientID)?.name || "Unnamed app",
        type: isCLI ? "cli" : "mcp",
        workspaces: memberWorkspaces
          .map(({ id, name }) => ({ id: toWorkspaceID(id), name }))
          .filter(({ id }) => clientWorkspaceIDs.includes(id)),
        scopes: [...new Set(clientGrants.flatMap(({ scopes }) => scopes))],
        connectedAt: new Date(createdAt).toISOString(),
        lastUsedAt: usedAt ? usedAt.toISOString() : null
      };
    })
    .sort((first, second) => {
      return (second.lastUsedAt ?? "").localeCompare(first.lastUsedAt ?? "");
    });
};

export { listConnectedApps };
