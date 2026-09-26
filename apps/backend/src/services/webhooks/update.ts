import { isDeepStrictEqual } from "node:util";
import {
  webhookConfigurationType,
  webhookUpdateInputType,
  type WebhookUpdateInput,
  type WebhookUpdateResult
} from "#backend/contracts/schemas/webhooks";
import { webhookEndpoints } from "#backend/db/webhooks";
import { config } from "#backend/lib/config";
import { withAuthorization } from "#backend/lib/policy";
import { createSecretEncryption } from "#backend/lib/security/encryption";
import { assertWebhookAuthority } from "#backend/lib/webhooks/delegation";
import { getDeliveryTime } from "#backend/lib/webhooks/delivery/locking";
import {
  describeWebhookEndpoints,
  getWebhookConfiguration,
  loadWebhookEndpoint
} from "#backend/lib/webhooks/endpoints";
import {
  assertWebhookDestination,
  limitWebhookManagement,
  lockWebhookForUpdate,
  parseWebhookInput,
  reconcileWebhookConfiguration,
  recordWebhookRevision
} from "#backend/lib/webhooks/management";
import { webhookManageRequirements } from "#backend/lib/webhooks/permissions";
import { createWebhookSecrets } from "#backend/lib/webhooks/secrets";
import { and, eq } from "drizzle-orm";

const updateWebhook = withAuthorization<WebhookUpdateInput, undefined, WebhookUpdateResult>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const { id, expectedRevision, ...patch } = parseWebhookInput(webhookUpdateInputType, input);
    const workspaceID = auth.workspaceID;
    const previous = await lockWebhookForUpdate(database, workspaceID, { id, expectedRevision });
    const stored = getWebhookConfiguration(previous);
    const configuration = parseWebhookInput(webhookConfigurationType, {
      ...stored,
      ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
    });
    const urlChanged = configuration.url !== previous.url;
    // Events, collections, channels, and restricted content together define what it can send.
    const scopeChanged = (
      ["eventTypes", "collections", "channels", "restrictedContent"] as const
    ).some((key) => !isDeepStrictEqual(configuration[key], stored[key]));
    const enabling = configuration.enabled && !previous.enabled;
    const stateChanged = configuration.enabled !== previous.enabled;

    if (urlChanged || scopeChanged || enabling) {
      await assertWebhookAuthority({ auth, database, configuration: stored, retained: true });
      await assertWebhookAuthority({ auth, database, configuration });
    }

    if (urlChanged || enabling) assertWebhookDestination(configuration.url);
    if (urlChanged) await limitWebhookManagement(workspaceID, "secret");

    const now = await getDeliveryTime(database);

    if (isDeepStrictEqual(configuration, stored)) {
      const [endpoint] = await describeWebhookEndpoints(database, [previous], now);

      return { secretChanged: false, endpoint: endpoint! };
    }

    const revision = previous.revision + 1;
    const destinationRevision = previous.destinationRevision + (urlChanged ? 1 : 0);
    const replacement = urlChanged
      ? createWebhookSecrets({
          encryption: createSecretEncryption(config.ENCRYPTION_KEYS),
          workspaceID,
          endpointID: id,
          destinationRevision,
          now
        })
      : null;
    const resetFailures = enabling || urlChanged;

    await recordWebhookRevision(database, {
      workspaceID,
      id,
      configuration,
      revision,
      destinationRevision,
      now
    });
    await database
      .update(webhookEndpoints)
      .set({
        ...configuration,
        ...replacement?.state,
        revision,
        destinationRevision,
        executionGeneration: previous.executionGeneration + (urlChanged || stateChanged ? 1 : 0),
        disabledReason: configuration.enabled
          ? null
          : stateChanged
            ? "manual"
            : previous.disabledReason,
        ...(resetFailures
          ? {
              consecutiveFailures: 0,
              firstFailureAt: null,
              lastFailureAt: null,
              lastFailureCategory: null
            }
          : {}),
        ...(urlChanged ? { lastSuccessAt: null } : {}),
        updatedAt: now
      })
      .where(
        and(
          eq(webhookEndpoints.workspaceID, previous.workspaceID),
          eq(webhookEndpoints.id, previous.id)
        )
      );

    if (urlChanged || stateChanged || scopeChanged) {
      await reconcileWebhookConfiguration(database, workspaceID, id);
    }

    // Reconciliation can also automatically disable an already-failing endpoint.
    const row = await loadWebhookEndpoint(database, { workspaceID, id });
    const [endpoint] = await describeWebhookEndpoints(
      database,
      [row],
      await getDeliveryTime(database)
    );

    return replacement
      ? { secretChanged: true, endpoint: endpoint!, secret: replacement.secret }
      : { secretChanged: false, endpoint: endpoint! };
  }
);

export { updateWebhook };
