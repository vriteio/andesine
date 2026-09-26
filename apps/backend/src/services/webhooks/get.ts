import type { WebhookEndpoint } from "#backend/contracts/schemas/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { publicID } from "#backend/lib/primitives/id";
import { getDeliveryTime } from "#backend/lib/webhooks/delivery/locking";
import { describeWebhookEndpoints, loadWebhookEndpoint } from "#backend/lib/webhooks/endpoints";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { webhookReadRequirements } from "#backend/lib/webhooks/permissions";

interface GetWebhookInput {
  id: string;
}

const getWebhook = withAuthorization<GetWebhookInput, undefined, WebhookEndpoint>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const id = parseWebhookInput(publicID("wh"), input.id);
    const row = await loadWebhookEndpoint(database, { workspaceID: auth.workspaceID, id });
    const now = await getDeliveryTime(database);
    const [endpoint] = await describeWebhookEndpoints(database, [row], now);

    return endpoint!;
  }
);

export { getWebhook };
