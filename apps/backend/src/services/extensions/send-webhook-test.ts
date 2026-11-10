import { type WebhookEventName } from "@andesine/contracts/webhooks";
import { toUUID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { isVisibleExtension } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { consumeRateLimit } from "#backend/lib/security";
import { createWebhookTestDelivery } from "#backend/lib/webhooks/test-delivery";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { loadExtensionWebhook, isExtensionActive } from "@andesine/server/extensions";

interface SendWebhookTestInput {
  extensionID: string;
  webhookID: string;
  type: WebhookEventName;
}
interface SendWebhookTestResult {
  deliveryID: string;
}

const TEST_EVENT_LIMIT = { max: 10, window: 60 };

const sendWebhookTest = withAuthorization<SendWebhookTestInput, undefined, SendWebhookTestResult>(
  {
    permissions: { session: ["extensions"], oauth: ["extensions"] },
    transaction: "locked-workspace"
  },
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

    if (!extension.development) {
      throw new ORPCError("FORBIDDEN", {
        message: "Test events are available only for development extensions"
      });
    }

    if (!isExtensionActive(extension)) {
      throw new ORPCError("CONFLICT", { message: "Test events need an enabled extension" });
    }

    const endpoint = await loadExtensionWebhook(database, extension.id, input.webhookID);

    if (!endpoint.eventTypes.includes(input.type)) {
      throw new ORPCError("BAD_REQUEST", { message: "Select an event of this webhook" });
    }

    const limit = await consumeRateLimit({
      scope: "extension-test",
      key: extension.id,
      limit: TEST_EVENT_LIMIT
    });

    if (!limit.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many test events; try again shortly",
        data: { limit: "rate", retryAfterSeconds: limit.retryAfter }
      });
    }

    return { deliveryID: await createWebhookTestDelivery(database, endpoint, input.type) };
  }
);

export { sendWebhookTest };
