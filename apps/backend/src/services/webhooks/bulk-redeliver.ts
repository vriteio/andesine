import {
  webhookBulkRedeliveryInputType,
  type WebhookBulkRedeliveryInput,
  type WebhookRun,
  webhookManageRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { redeliverWebhookDeliveries } from "#backend/lib/webhooks/history/redelivery";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

// All deliveries are replayed in one transaction; any ineligible delivery fails the request.
const bulkRedeliverWebhook = withAuthorization<WebhookBulkRedeliveryInput, undefined, WebhookRun[]>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(webhookBulkRedeliveryInputType, input);

    return redeliverWebhookDeliveries(database, auth, parsed);
  }
);

export { bulkRedeliverWebhook };
