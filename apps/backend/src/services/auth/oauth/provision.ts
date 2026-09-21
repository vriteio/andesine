import { oauthClients, oauthClientResources } from "#backend/db/oauth";
import { CLI_CLIENT_ID, CLI_GRANTS, CLI_SCOPES } from "#backend/lib/auth/oauth";
import { db } from "#backend/lib/adapters/postgres";
import { config } from "#backend/lib/config";

/** Seed the public CLI client after the provider has seeded this instance's resource. */
const provision = async (): Promise<void> => {
  const definition = {
    name: "Andesine CLI",
    tokenEndpointAuthMethod: "none",
    applicationType: "native",
    scopes: CLI_SCOPES,
    grantTypes: CLI_GRANTS,
    redirectUris: [],
    responseTypes: [],
    skipConsent: false,
    enableEndSession: false,
    updatedAt: new Date()
  };

  await db.transaction(async (transaction) => {
    await transaction
      .insert(oauthClients)
      .values({
        ...definition,
        clientId: CLI_CLIENT_ID,
        createdAt: new Date()
      })
      .onConflictDoUpdate({ target: oauthClients.clientId, set: definition });
    await transaction
      .insert(oauthClientResources)
      .values({
        clientId: CLI_CLIENT_ID,
        resourceId: config.PUBLIC_API_URL,
        createdAt: new Date()
      })
      .onConflictDoNothing();
  });
};

export { provision };
