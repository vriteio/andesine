import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  webhookRunListInputType,
  type WebhookRunListInput,
  type WebhookRun,
  webhookReadRequirements
} from "@andesine/contracts/webhooks";
import { type Page } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { listWebhookRunPage } from "#backend/lib/webhooks/history/pages";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

const listWebhookRuns = withAuthorization<WebhookRunListInput, undefined, Page<WebhookRun>>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const page = parseWebhookInput(webhookRunListInputType, input);
    const now = await getDeliveryTime(database);
    const identity = { ...page, workspaceID: auth.workspaceID, now };

    return listWebhookRunPage(database, identity);
  }
);

export { listWebhookRuns };
