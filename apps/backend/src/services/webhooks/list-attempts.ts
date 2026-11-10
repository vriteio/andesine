import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  webhookAttemptListInputType,
  type WebhookAttemptListInput,
  type WebhookAttempt,
  webhookReadRequirements
} from "@andesine/contracts/webhooks";
import { type Page } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { listWebhookAttemptPage } from "#backend/lib/webhooks/history/pages";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

const listWebhookAttempts = withAuthorization<
  WebhookAttemptListInput,
  undefined,
  Page<WebhookAttempt>
>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const page = parseWebhookInput(webhookAttemptListInputType, input);
    const now = await getDeliveryTime(database);
    const identity = { ...page, workspaceID: auth.workspaceID, now };

    return listWebhookAttemptPage(database, identity);
  }
);

export { listWebhookAttempts };
