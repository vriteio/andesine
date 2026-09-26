import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  webhookDeliveryInputType,
  type WebhookDeliveryInput,
  type WebhookDeliveryDetails,
  webhookReadRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import {
  describeWebhookDeliveries,
  describeWebhookRuns
} from "#backend/lib/webhooks/history/describe";
import { readRetainedWebhookPayload } from "#backend/lib/webhooks/history/payload";
import { loadWebhookDelivery, loadWebhookRun } from "#backend/lib/webhooks/history/records";
import { parseWebhookInput } from "#backend/lib/webhooks/management";

const getWebhookDelivery = withAuthorization<
  WebhookDeliveryInput,
  undefined,
  WebhookDeliveryDetails
>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(webhookDeliveryInputType, input);
    const now = await getDeliveryTime(database);
    const identity = { ...parsed, workspaceID: auth.workspaceID, now };
    const row = await loadWebhookDelivery(database, identity);
    const { event, allowed } = await readRetainedWebhookPayload(database, auth, row);
    const [delivery] = await describeWebhookDeliveries(database, [
      {
        delivery: row,
        event: { type: event.type, test: event.test, occurredAt: new Date(event.occurredAt) }
      }
    ]);
    const runs = delivery!.currentRunID
      ? await describeWebhookRuns(database, [
          await loadWebhookRun(database, { ...identity, runID: delivery!.currentRunID })
        ])
      : [];

    return {
      delivery: delivery!,
      payload: allowed ? { availability: "available", event } : { availability: "forbidden" },
      currentRun: runs[0] ?? null
    };
  }
);

export { getWebhookDelivery };
