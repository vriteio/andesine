import { webhookEndpoints } from "@andesine/server/database";
import { createSecretEncryption } from "@andesine/server/security";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  describeWebhookEndpoints,
  getWebhookConfiguration
} from "@andesine/server/webhooks/recording";
import {
  rotateWebhookSecrets,
  WebhookSecretRotationConflictError
} from "@andesine/server/webhooks/signing";
import {
  webhookRevisionInputType,
  type WebhookRevisionInput,
  type WebhookSecretResult,
  webhookManageRequirements
} from "@andesine/contracts/webhooks";
import { config } from "#backend/lib/config";
import { withAuthorization } from "#backend/lib/policy";
import { assertWebhookAuthority } from "#backend/lib/webhooks/delegation";
import {
  limitWebhookManagement,
  lockWebhookForUpdate,
  parseWebhookInput,
  recordWebhookRevision
} from "#backend/lib/webhooks/management";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import * as z from "zod";

interface RotateWebhookSecretInput extends WebhookRevisionInput {
  mode: "overlap" | "immediate";
}

const rotateWebhookSecret = withAuthorization<
  RotateWebhookSecretInput,
  undefined,
  WebhookSecretResult
>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(
      webhookRevisionInputType.extend({ mode: z.enum(["overlap", "immediate"]) }),
      input
    );
    const workspaceID = auth.workspaceID;
    const previous = await lockWebhookForUpdate(database, workspaceID, parsed);

    await assertWebhookAuthority({
      auth,
      database,
      configuration: getWebhookConfiguration(previous),
      retained: true
    });
    await limitWebhookManagement(workspaceID, "secret");

    const now = await getDeliveryTime(database);
    const revision = previous.revision + 1;
    const replacement = (() => {
      try {
        return rotateWebhookSecrets({
          encryption: createSecretEncryption(config.ENCRYPTION_KEYS),
          workspaceID,
          endpointID: parsed.id,
          destinationRevision: previous.destinationRevision,
          now,
          mode: parsed.mode,
          state: previous
        });
      } catch (error) {
        if (!(error instanceof WebhookSecretRotationConflictError)) throw error;

        throw new ORPCError("CONFLICT", { message: error.message });
      }
    })();

    await recordWebhookRevision(database, {
      workspaceID,
      id: parsed.id,
      revision,
      destinationRevision: previous.destinationRevision,
      configuration: getWebhookConfiguration(previous),
      now
    });

    const [row] = await database
      .update(webhookEndpoints)
      .set({ ...replacement.state, revision, updatedAt: now })
      .where(
        and(
          eq(webhookEndpoints.workspaceID, previous.workspaceID),
          eq(webhookEndpoints.id, previous.id)
        )
      )
      .returning();
    const [endpoint] = await describeWebhookEndpoints(database, [row!], now);

    return { endpoint: endpoint!, secret: replacement.secret };
  }
);

export { rotateWebhookSecret };
