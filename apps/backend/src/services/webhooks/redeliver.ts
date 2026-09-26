import {
  webhookRedeliveryInputType,
  type WebhookRedeliveryInput,
  type WebhookRun
} from "#backend/contracts/schemas/webhook-deliveries";
import { withAuthorization } from "#backend/lib/policy";
import { redeliverWebhookDeliveries } from "#backend/lib/webhooks/history/redelivery";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { webhookManageRequirements } from "#backend/lib/webhooks/permissions";

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
