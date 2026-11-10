import { invitations, stripeWebhookEvents, workspaces } from "@andesine/server/database";
// SPDX-License-Identifier: Elastic-2.0
import { db } from "#backend/lib/adapters";
import { isTerminalSubscription } from "#backend/lib/policy";
import { and, eq, ne, sql } from "drizzle-orm";
import type Stripe from "stripe";

const registerStripeWebhookEvent = async (event: Stripe.Event): Promise<boolean> => {
  await db
    .insert(stripeWebhookEvents)
    .values({
      id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>
    })
    .onConflictDoNothing({ target: stripeWebhookEvents.id });
  const [storedEvent] = await db
    .select({ status: stripeWebhookEvents.status })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.id, event.id));

  return storedEvent?.status === "processed";
};
const getWorkspaceDeletionState = async (workspaceID: string) => {
  const [workspace] = await db
    .select({ id: workspaces.id, deletingAt: workspaces.deletingAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceID))
    .limit(1);

  return workspace;
};
const persistStripeWebhookResult = async (input: {
  eventID: string;
  workspaceID: string | null;
  update?: Partial<typeof workspaces.$inferInsert>;
}): Promise<{ applied: boolean; revokedInviteIDs: string[] }> => {
  return db.transaction(async (tx) => {
    const [record] = await tx
      .select({ status: stripeWebhookEvents.status })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.id, input.eventID))
      .for("update");

    if (!record || record.status === "processed") return { applied: false, revokedInviteIDs: [] };

    const [workspace] = input.workspaceID
      ? await tx
          .select({
            id: workspaces.id,
            deletingAt: workspaces.deletingAt,
            subscriptionPlan: workspaces.subscriptionPlan,
            subscriptionStatus: workspaces.subscriptionStatus,
            subscriptionData: workspaces.subscriptionData
          })
          .from(workspaces)
          .where(eq(workspaces.id, input.workspaceID))
          .for("update")
      : [];
    const persistedWorkspaceID = workspace?.id ?? null;
    const storedSubscriptionID = workspace?.subscriptionData?.subscriptionID;
    const eventSubscriptionID = input.update?.subscriptionData?.subscriptionID;
    // A late event of an ended subscription must not replace the workspace's newer one.
    const isStaleSubscription =
      Boolean(storedSubscriptionID && eventSubscriptionID) &&
      storedSubscriptionID !== eventSubscriptionID &&
      !isTerminalSubscription(workspace?.subscriptionStatus ?? "canceled") &&
      isTerminalSubscription(input.update?.subscriptionStatus ?? "");
    const isDowngrade =
      workspace?.subscriptionPlan === "pro" && input.update?.subscriptionPlan === "free";

    let revokedInviteIDs: string[] = [];

    await tx
      .update(stripeWebhookEvents)
      .set({
        status: "processing",
        attempts: sql`${stripeWebhookEvents.attempts} + 1`,
        workspaceID: persistedWorkspaceID,
        lastError: null
      })
      .where(eq(stripeWebhookEvents.id, input.eventID));

    const update = workspace?.deletingAt || isStaleSubscription ? undefined : input.update;
    const applied = Boolean(persistedWorkspaceID && update);

    if (persistedWorkspaceID && update) {
      await tx.update(workspaces).set(update).where(eq(workspaces.id, persistedWorkspaceID));

      if (isDowngrade) {
        const revokedInvites = await tx
          .delete(invitations)
          .where(
            and(
              eq(invitations.workspaceID, persistedWorkspaceID),
              eq(invitations.status, "pending")
            )
          )
          .returning({ id: invitations.id });

        revokedInviteIDs = revokedInvites.map(({ id }) => id);
      }
    }

    await tx
      .update(stripeWebhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(stripeWebhookEvents.id, input.eventID));

    return { applied, revokedInviteIDs };
  });
};
const failStripeWebhookEvent = async (eventID: string, error: unknown): Promise<void> => {
  await db
    .update(stripeWebhookEvents)
    .set({
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error)
    })
    .where(and(eq(stripeWebhookEvents.id, eventID), ne(stripeWebhookEvents.status, "processed")));
};

export {
  failStripeWebhookEvent,
  getWorkspaceDeletionState,
  persistStripeWebhookResult,
  registerStripeWebhookEvent
};
