import { billingPeriods, memberships, workspaces } from "@andesine/server/database";
// SPDX-License-Identifier: Elastic-2.0
import {
  dropUsageCounters,
  getPeriodStart,
  getUsageCounterKey,
  recordPeriodSeats
} from "#backend/lib/billing";
import { config } from "#backend/lib/config";
import { toUUID } from "@andesine/contracts/primitives";
import { db, stripe } from "#backend/lib/adapters";
import { ORPCError } from "@orpc/server";
import { and, count, eq } from "drizzle-orm";

const updateSeats = async (input: { workspaceID: string }): Promise<void> => {
  if (!config.BILLING_ENABLED) return;

  const workspaceID = toUUID(input.workspaceID);

  await db.transaction(async (tx) => {
    const [workspace] = await tx
      .select({ subscriptionData: workspaces.subscriptionData })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceID))
      .for("update");
    const seatItemID = workspace?.subscriptionData?.seatItemID;

    if (!seatItemID) return;
    if (!stripe) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Stripe must be configured before updating subscription seats"
      });
    }

    const [{ value: seatCount }] = await tx
      .select({ value: count() })
      .from(memberships)
      .where(eq(memberships.workspaceID, workspaceID));

    const quantity = Math.max(seatCount, 1);
    const [seatItem, [period]] = await Promise.all([
      stripe.subscriptionItems.retrieve(seatItemID),
      tx
        .select({ seats: billingPeriods.seats })
        .from(billingPeriods)
        .where(
          and(
            eq(billingPeriods.workspaceID, workspaceID),
            eq(billingPeriods.periodStart, getPeriodStart(new Date()))
          )
        )
    ]);
    const billedQuantity = seatItem.quantity ?? 0;
    // Removed seats get no credit, so the month is paid for its highest seat count; the
    // subscription renews on the 1st of each UTC month, as billing periods do.
    const paidSeats = Math.max(period?.seats ?? 0, billedQuantity);
    // Back to the paid count first, so only seats above it are prorated.
    const restoresPaidSeats = quantity > paidSeats && billedQuantity < paidSeats;

    if (restoresPaidSeats) {
      await stripe.subscriptionItems.update(seatItemID, {
        quantity: paidSeats,
        proration_behavior: "none"
      });
    }

    await stripe.subscriptionItems.update(seatItemID, {
      quantity,
      proration_behavior: quantity > paidSeats ? "create_prorations" : "none"
    });
    await recordPeriodSeats(tx, workspaceID);
  });
  // The cached pool follows the new seat count.
  await dropUsageCounters(getUsageCounterKey(workspaceID, new Date()));
};

export { updateSeats };
