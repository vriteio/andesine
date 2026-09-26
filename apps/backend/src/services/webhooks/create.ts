import {
  webhookCreateInputType,
  type WebhookCreateInput,
  type WebhookSecretResult
} from "#backend/contracts/schemas/webhooks";
import { webhookEndpoints } from "#backend/db/webhooks";
import { config } from "#backend/lib/config";
import { withAuthorization } from "#backend/lib/policy";
import { generateUUID, toUUID, toWebhookID } from "#backend/lib/primitives/id";
import { createSecretEncryption } from "#backend/lib/security/encryption";
import { assertWebhookAuthority } from "#backend/lib/webhooks/delegation";
import { getDeliveryTime } from "#backend/lib/webhooks/delivery/locking";
import {
  countWebhookEndpoints,
  describeWebhookEndpoints,
  MAX_WORKSPACE_WEBHOOKS
} from "#backend/lib/webhooks/endpoints";
import {
  assertWebhookDestination,
  assertWebhookWorkspace,
  limitWebhookManagement,
  parseWebhookInput,
  recordWebhookRevision
} from "#backend/lib/webhooks/management";
import { webhookManageRequirements } from "#backend/lib/webhooks/permissions";
import { createWebhookSecrets } from "#backend/lib/webhooks/secrets";
import { ORPCError } from "@orpc/server";

const createWebhook = withAuthorization<WebhookCreateInput, undefined, WebhookSecretResult>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const configuration = parseWebhookInput(webhookCreateInputType, input);
    const workspaceID = auth.workspaceID;

    await assertWebhookWorkspace(database, workspaceID);
    assertWebhookDestination(configuration.url);
    await assertWebhookAuthority({ auth, database, configuration });

    if ((await countWebhookEndpoints(database, { workspaceID })) >= MAX_WORKSPACE_WEBHOOKS) {
      throw new ORPCError("CONFLICT", { message: "A workspace can have at most 10 webhooks" });
    }

    await limitWebhookManagement(workspaceID, "create");

    const id = toWebhookID(generateUUID());
    const now = await getDeliveryTime(database);
    const { secret, state } = createWebhookSecrets({
      encryption: createSecretEncryption(config.ENCRYPTION_KEYS),
      workspaceID,
      endpointID: id,
      destinationRevision: 1,
      now
    });
    const [row] = await database
      .insert(webhookEndpoints)
      .values({
        ...configuration,
        ...state,
        id: toUUID(id),
        workspaceID: toUUID(workspaceID),
        disabledReason: configuration.enabled ? null : "manual",
        createdAt: now,
        updatedAt: now
      })
      .returning();

    await recordWebhookRevision(database, {
      workspaceID,
      id,
      configuration,
      revision: 1,
      destinationRevision: 1,
      now
    });

    const [endpoint] = await describeWebhookEndpoints(database, [row!], now);

    return { endpoint: endpoint!, secret };
  }
);

export { createWebhook };
