import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  describeWebhookEndpoints,
  listWebhookEndpoints
} from "@andesine/server/webhooks/recording";
import { type WebhookEndpoint, webhookReadRequirements } from "@andesine/contracts/webhooks";
import { pageInputType } from "@andesine/contracts/pagination";
import { toPage, type Page, type PageInput } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { publicID } from "@andesine/contracts/primitives";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

const listWebhooks = withAuthorization<PageInput, undefined, Page<WebhookEndpoint>>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const page = parseWebhookInput(
      pageInputType.extend({ cursor: publicID("wh").optional() }),
      input
    );
    const rows = await listWebhookEndpoints(database, {
      ...page,
      workspaceID: auth.workspaceID,
      limit: page.limit + 1
    });
    const now = await getDeliveryTime(database);
    const endpoints = await describeWebhookEndpoints(database, rows, now);

    return toPage(endpoints, page.limit);
  }
);

export { listWebhooks };
