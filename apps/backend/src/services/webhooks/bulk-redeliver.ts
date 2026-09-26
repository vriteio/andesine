import {
  webhookBulkRedeliveryInputType,
  type WebhookBulkRedeliveryInput,
  type WebhookRun
} from "#backend/contracts/schemas/webhook-deliveries";
import { withAuthorization } from "#backend/lib/policy";
import { redeliverWebhookDeliveries } from "#backend/lib/webhooks/history/redelivery";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { webhookManageRequirements } from "#backend/lib/webhooks/permissions";

// All deliveries are replayed in one transaction; any ineligible delivery fails the request.
const bulkRedeliverWebhook = withAuthorization<WebhookBulkRedeliveryInput, undefined, WebhookRun[]>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(webhookBulkRedeliveryInputType, input);

    return redeliverWebhookDeliveries(database, auth, parsed);
  }
);

export { bulkRedeliverWebhook };
