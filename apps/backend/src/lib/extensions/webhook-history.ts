import { toUUID, toWebhookID } from "@andesine/contracts/primitives";
import { extensions, webhookEndpoints, type DatabaseTransaction } from "@andesine/server/database";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { ORPCError } from "@orpc/server";
import { type SessionData } from "#backend/lib/policy";
import { and, eq, isNull } from "drizzle-orm";
import { isVisibleExtension } from "./installed";

interface ExtensionWebhookTarget {
  extensionID: string;
  webhookID: string;
}
interface ExtensionWebhookHistoryScope {
  /** The managed endpoint's public ID, for the shared history functions. */
  id: string;
  workspaceID: string;
  extensionID: string;
  now: Date;
}

/** The history scope of a visible installed extension's live webhook, or NOT_FOUND. */
const getExtensionWebhookHistoryScope = async (
  database: DatabaseTransaction,
  auth: SessionData,
  workspaceID: string,
  target: ExtensionWebhookTarget
): Promise<ExtensionWebhookHistoryScope> => {
  const [row] = await database
    .select({ id: webhookEndpoints.id, extensionID: extensions.id })
    .from(webhookEndpoints)
    .innerJoin(extensions, eq(extensions.id, webhookEndpoints.extensionID))
    .where(
      and(
        eq(extensions.id, toUUID(target.extensionID)),
        eq(extensions.workspaceID, toUUID(workspaceID)),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth),
        eq(webhookEndpoints.extensionWebhookID, target.webhookID),
        isNull(webhookEndpoints.deletedAt)
      )
    );

  if (!row) throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });

  return {
    id: toWebhookID(row.id),
    workspaceID,
    extensionID: row.extensionID,
    now: await getDeliveryTime(database)
  };
};

export { getExtensionWebhookHistoryScope };
