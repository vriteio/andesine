import { getWebhookConfiguration } from "@andesine/server/webhooks/recording";
import {
  webhookTestInputType,
  type WebhookTestInput,
  webhookManageRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { assertWebhookAuthority } from "#backend/lib/webhooks/delegation";
import {
  assertWebhookDestination,
  limitWebhookManagement,
  lockWebhookForUpdate,
  parseWebhookInput
} from "#backend/lib/webhooks/management";
import { createWebhookTestDelivery } from "#backend/lib/webhooks/test-delivery";
import { ORPCError } from "@orpc/server";

interface WebhookTestResult {
  deliveryID: string;
}

const sendWebhookTest = withAuthorization<WebhookTestInput, undefined, WebhookTestResult>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(webhookTestInputType, input);
    const endpoint = await lockWebhookForUpdate(database, auth.workspaceID, parsed);

    await assertWebhookAuthority({
      auth,
      database,
      configuration: getWebhookConfiguration(endpoint),
      retained: true
    });
    assertWebhookDestination(endpoint.url);

    if (!endpoint.eventTypes.includes(parsed.type)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Select an event configured for this webhook"
      });
    }

    await limitWebhookManagement(auth.workspaceID, "test");

    return { deliveryID: await createWebhookTestDelivery(database, endpoint, parsed.type) };
  }
);

export { sendWebhookTest };
