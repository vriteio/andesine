import { webhookEndpoints } from "@andesine/server/database";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { getWebhookConfiguration } from "@andesine/server/webhooks/recording";
import {
  webhookRevisionInputType,
  type WebhookRevisionInput,
  webhookManageRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import {
  lockWebhookForUpdate,
  parseWebhookInput,
  reconcileWebhookConfiguration,
  recordWebhookRevision
} from "#backend/lib/webhooks/management";
import { and, eq } from "drizzle-orm";

const deleteWebhook = withAuthorization<WebhookRevisionInput>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(webhookRevisionInputType, input);
    const workspaceID = auth.workspaceID;
    const endpoint = await lockWebhookForUpdate(database, workspaceID, parsed);
    const now = await getDeliveryTime(database);
    const revision = endpoint.revision + 1;
    const configuration = { ...getWebhookConfiguration(endpoint), enabled: false };

    await recordWebhookRevision(database, {
      workspaceID,
      id: parsed.id,
      configuration,
      revision,
      destinationRevision: endpoint.destinationRevision,
      now
    });
    await database
      .update(webhookEndpoints)
      .set({
        enabled: false,
        disabledReason: "manual",
        deletedAt: now,
        updatedAt: now,
        revision,
        executionGeneration: endpoint.executionGeneration + 1,
        currentSecretCiphertext: null,
        previousSecretCiphertext: null,
        previousSecretExpiresAt: null
      })
      .where(
        and(
          eq(webhookEndpoints.workspaceID, endpoint.workspaceID),
          eq(webhookEndpoints.id, endpoint.id)
        )
      );
    await reconcileWebhookConfiguration(database, workspaceID, parsed.id);
  }
);

export { deleteWebhook };
