import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { describeWebhookEndpoints, loadWebhookEndpoint } from "@andesine/server/webhooks/recording";
import { type WebhookEndpoint, webhookReadRequirements } from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { publicID } from "@andesine/contracts/primitives";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

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
