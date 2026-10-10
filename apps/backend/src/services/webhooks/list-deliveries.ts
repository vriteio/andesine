import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  webhookDeliveryListInputType,
  type WebhookDeliveryListInput,
  type WebhookDelivery,
  webhookReadRequirements
} from "@andesine/contracts/webhooks";
import { type Page } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { listWebhookDeliveryPage } from "#backend/lib/webhooks/history/pages";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

const listWebhookDeliveries = withAuthorization<
  WebhookDeliveryListInput,
  undefined,
  Page<WebhookDelivery>
>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const page = parseWebhookInput(webhookDeliveryListInputType, input);
    const workspaceID = auth.workspaceID;
    const now = await getDeliveryTime(database);

    return listWebhookDeliveryPage(database, { ...page, workspaceID, now });
  }
);

export { listWebhookDeliveries };
