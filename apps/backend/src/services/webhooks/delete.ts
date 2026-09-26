import {
  webhookRevisionInputType,
  type WebhookRevisionInput
} from "#backend/contracts/schemas/webhooks";
import { webhookEndpoints } from "#backend/db/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import { getDeliveryTime } from "#backend/lib/webhooks/delivery/locking";
import { getWebhookConfiguration } from "#backend/lib/webhooks/endpoints";
import {
  lockWebhookForUpdate,
  parseWebhookInput,
  reconcileWebhookConfiguration,
  recordWebhookRevision
} from "#backend/lib/webhooks/management";
import { webhookManageRequirements } from "#backend/lib/webhooks/permissions";
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
