import { type ExtensionWebhookDeliveryDetails } from "@andesine/contracts/extensions";
import { getExtensionWebhookHistoryScope } from "#backend/lib/extensions/webhook-history";
import { withAuthorization } from "#backend/lib/policy";
import { getWebhookDeliveryDetails } from "#backend/lib/webhooks/history/pages";

interface GetDeliveryInput {
  extensionID: string;
  webhookID: string;
  deliveryID: string;
}

/** Content payloads follow the manager's read access; lifecycle payloads are always readable. */
const getDelivery = withAuthorization<GetDeliveryInput, undefined, ExtensionWebhookDeliveryDetails>(
  {
    permissions: { session: ["extensions"], oauth: ["extensions"] },
    transaction: "snapshot"
  },
  async ({ auth, database, input, workspaceID }) => {
    const scope = await getExtensionWebhookHistoryScope(database, auth, workspaceID, input);

    return getWebhookDeliveryDetails(database, auth, { ...scope, deliveryID: input.deliveryID });
  }
);

export { getDelivery };
