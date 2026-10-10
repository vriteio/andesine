import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  webhookDeliveryInputType,
  type WebhookDeliveryInput,
  type WebhookDeliveryDetails,
  webhookReadRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { getWebhookDeliveryDetails } from "#backend/lib/webhooks/history/pages";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

const getWebhookDelivery = withAuthorization<
  WebhookDeliveryInput,
  undefined,
  WebhookDeliveryDetails
>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(webhookDeliveryInputType, input);
    const now = await getDeliveryTime(database);
    const identity = { ...parsed, workspaceID: auth.workspaceID, now };

    // HTTP webhooks receive only HTTP webhook events, so the payload is a webhook event.
    return (await getWebhookDeliveryDetails(database, auth, identity)) as WebhookDeliveryDetails;
  }
);

export { getWebhookDelivery };
