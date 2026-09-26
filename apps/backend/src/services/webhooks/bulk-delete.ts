import {
  webhookBulkRevisionInputType,
  type WebhookBulkRevisionInput
} from "#backend/contracts/schemas/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { webhookManageRequirements } from "#backend/lib/webhooks/permissions";
import { deleteWebhook } from "./delete";

const bulkDeleteWebhooks = withAuthorization<WebhookBulkRevisionInput>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ auth, authorizationScope, input }) => {
    const { webhooks } = parseWebhookInput(webhookBulkRevisionInputType, input);

    for (const webhook of webhooks) {
      await deleteWebhook({ ...webhook, auth, skipAuthorization: authorizationScope });
    }
  }
);

export { bulkDeleteWebhooks };
