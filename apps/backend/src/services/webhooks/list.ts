import type { WebhookEndpoint } from "#backend/contracts/schemas/webhooks";
import { pageInputType } from "#backend/contracts/schemas/pagination";
import { toPage, type Page, type PageInput } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { publicID } from "#backend/lib/primitives/id";
import { getDeliveryTime } from "#backend/lib/webhooks/delivery/locking";
import { describeWebhookEndpoints, listWebhookEndpoints } from "#backend/lib/webhooks/endpoints";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { webhookReadRequirements } from "#backend/lib/webhooks/permissions";

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
