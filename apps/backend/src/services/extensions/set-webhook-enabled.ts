import { webhookEndpoints, extensions } from "@andesine/server/database";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { toWebhookID, toWorkspaceID } from "@andesine/contracts/primitives";
import { lockManagedExtension } from "#backend/lib/extensions/state";
import { withAuthorization } from "#backend/lib/policy";
import { reconcileWebhookConfiguration } from "#backend/lib/webhooks/management";
import { eq, sql } from "drizzle-orm";
import {
  getStoredConfiguration,
  loadExtensionWebhook,
  recordRevision,
  resolveWebhookState,
  isExtensionActive
} from "@andesine/server/extensions";

interface SetWebhookEnabledInput {
  extensionID: string;
  webhookID: string;
  enabled: boolean;
  expectedRevision: number;
}
interface SetWebhookEnabledResult {
  revision: number;
}

/** Enabling resets failure tracking without backfill; disabling cancels pending runs. */
const setWebhookEnabled = withAuthorization<
  SetWebhookEnabledInput,
  undefined,
  SetWebhookEnabledResult
>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const extension = await lockManagedExtension(
      database,
      auth,
      workspaceID,
      input.extensionID,
      input.expectedRevision
    );
    const endpoint = await loadExtensionWebhook(database, extension.id, input.webhookID);

    const state = input.enabled
      ? resolveWebhookState(endpoint.eventTypes, isExtensionActive(extension), null)
      : { enabled: false, disabledReason: "manual" as const };
    const isUnchanged =
      state.enabled === endpoint.enabled && state.disabledReason === endpoint.disabledReason;

    if (isUnchanged) return { revision: extension.revision };

    const now = await getDeliveryTime(database);
    const revision = endpoint.revision + 1;

    await recordRevision(
      database,
      { ...endpoint, revision },
      { ...getStoredConfiguration(endpoint), enabled: state.enabled },
      now
    );
    await database
      .update(webhookEndpoints)
      .set({
        ...state,
        revision,
        executionGeneration:
          endpoint.executionGeneration + (state.enabled !== endpoint.enabled ? 1 : 0),
        ...(input.enabled && {
          consecutiveFailures: 0,
          firstFailureAt: null,
          lastFailureAt: null,
          lastFailureCategory: null
        }),
        updatedAt: now
      })
      .where(eq(webhookEndpoints.id, endpoint.id));
    await reconcileWebhookConfiguration(
      database,
      toWorkspaceID(extension.workspaceID),
      toWebhookID(endpoint.id)
    );

    const [updated] = await database
      .update(extensions)
      .set({ revision: sql`${extensions.revision} + 1`, updatedAt: sql`now()` })
      .where(eq(extensions.id, extension.id))
      .returning({ revision: extensions.revision });

    return { revision: updated.revision };
  }
);

export { setWebhookEnabled };
