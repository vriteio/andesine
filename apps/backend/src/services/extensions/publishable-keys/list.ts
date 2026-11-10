import { type ExtensionPublishableKey } from "@andesine/contracts/extensions";
import { apiKeys } from "@andesine/server/database";
import { mapAPIKey } from "#backend/lib/data";
import { assertKeyManager, toManagedKey } from "#backend/lib/extensions/publishable-keys";
import { withAuthorization } from "#backend/lib/policy";
import { asc, eq } from "drizzle-orm";

const listPublishableKeys = withAuthorization<object, undefined, ExtensionPublishableKey[]>(
  { permissions: { extension: true } },
  async ({ auth, database }) => {
    const keys = await database
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.extensionID, assertKeyManager(auth)))
      .orderBy(asc(apiKeys.createdAt));

    return keys.map((key) => toManagedKey(mapAPIKey(key)));
  }
);

export { listPublishableKeys };
