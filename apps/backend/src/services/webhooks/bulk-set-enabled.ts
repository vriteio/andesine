import {
  webhookBulkEnabledInputType,
  type WebhookBulkEnabledInput,
  type WebhookEndpoint,
  webhookManageRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { updateWebhook } from "./update";

// Each webhook goes through the full update checks in one shared transaction.
const bulkSetWebhooksEnabled = withAuthorization<
  WebhookBulkEnabledInput,
  undefined,
  WebhookEndpoint[]
>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ auth, authorizationScope, input }) => {
    const { enabled, webhooks } = parseWebhookInput(webhookBulkEnabledInputType, input);
    const endpoints: WebhookEndpoint[] = [];

    for (const webhook of webhooks) {
      const result = await updateWebhook({
        ...webhook,
        enabled,
        auth,
        skipAuthorization: authorizationScope
      });

      endpoints.push(result.endpoint);
    }

    return endpoints;
  }
);

export { bulkSetWebhooksEnabled };
