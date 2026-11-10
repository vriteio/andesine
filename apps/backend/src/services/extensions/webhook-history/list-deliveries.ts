import { type ExtensionWebhookDelivery } from "@andesine/contracts/extensions";
import { type Page } from "#backend/lib/api/pagination";
import { getExtensionWebhookHistoryScope } from "#backend/lib/extensions/webhook-history";
import { withAuthorization } from "#backend/lib/policy";
import { listWebhookDeliveryPage } from "#backend/lib/webhooks/history/pages";

interface ListDeliveriesInput {
  extensionID: string;
  webhookID: string;
  cursor?: string;
  state?: ExtensionWebhookDelivery["state"];
  limit: number;
}

const listDeliveries = withAuthorization<
  ListDeliveriesInput,
  undefined,
  Page<ExtensionWebhookDelivery>
>(
  { permissions: { session: ["extensions"] }, transaction: "snapshot" },
  async ({ auth, database, input, workspaceID }) => {
    const { extensionID, webhookID, ...page } = input;
    const scope = await getExtensionWebhookHistoryScope(database, auth, workspaceID, {
      extensionID,
      webhookID
    });

    return listWebhookDeliveryPage(database, { ...page, ...scope });
  }
);

export { listDeliveries };
