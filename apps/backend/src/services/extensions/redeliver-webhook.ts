import { type WebhookRun } from "@andesine/contracts/webhooks";
import { toUUID, toWebhookID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { isVisibleExtension } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { redeliverWebhookDelivery } from "#backend/lib/webhooks/history/redelivery";
import { limitWebhookManagement } from "#backend/lib/webhooks/management";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { loadExtensionWebhook, isExtensionActive } from "@andesine/server/extensions";

interface RedeliverWebhookInput {
  extensionID: string;
  webhookID: string;
  deliveryIDs: string[];
}

/** Replays deliveries to the current backend URL; the request counts once for rate limiting. */
const redeliverWebhook = withAuthorization<RedeliverWebhookInput, undefined, WebhookRun[]>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const [extension] = await database
      .select()
      .from(extensions)
      .where(
        and(
          eq(extensions.id, toUUID(input.extensionID)),
          eq(extensions.workspaceID, workspaceID),
          isNull(extensions.uninstalledAt),
          isVisibleExtension(auth)
        )
      )
      .for("update");

    if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

    if (!isExtensionActive(extension)) {
      throw new ORPCError("CONFLICT", { message: "Replay needs an enabled extension" });
    }

    const endpoint = await loadExtensionWebhook(database, extension.id, input.webhookID);
    const runs: WebhookRun[] = [];

    if (!endpoint.enabled) {
      throw new ORPCError("CONFLICT", { message: "Replay needs an enabled webhook" });
    }

    for (const deliveryID of input.deliveryIDs) {
      runs.push(
        await redeliverWebhookDelivery(database, auth, endpoint, {
          id: toWebhookID(endpoint.id),
          deliveryID
        })
      );
    }

    // A rejected request rolls back the runs inserted above.
    await limitWebhookManagement(auth.workspaceID, "redeliver");

    return runs;
  }
);

export { redeliverWebhook };
