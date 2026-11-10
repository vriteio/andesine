import {
  webhookRedeliveryInputType,
  type WebhookRedeliveryInput,
  type WebhookRun,
  webhookManageRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { redeliverWebhookDeliveries } from "#backend/lib/webhooks/history/redelivery";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

const redeliverWebhook = withAuthorization<WebhookRedeliveryInput, undefined, WebhookRun>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const { deliveryID, ...parsed } = parseWebhookInput(webhookRedeliveryInputType, input);
    const [run] = await redeliverWebhookDeliveries(database, auth, {
      ...parsed,
      deliveryIDs: [deliveryID]
    });

    return run!;
  }
);

export { redeliverWebhook };
