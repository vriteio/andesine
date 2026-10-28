// SPDX-License-Identifier: Elastic-2.0
import { config } from "#backend/lib/config";
import { emitMembershipEvent, emitWorkspaceStateEvent } from "#backend/events";
import { toInviteID, toUUID } from "@andesine/contracts/primitives";
import { stripe } from "#backend/lib/adapters";
import { Auth } from "#backend/services/auth";
import { Billing } from "#backend/services/billing";
import type { FastifyReply, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import {
  failStripeWebhookEvent,
  getWorkspaceDeletionState,
  persistStripeWebhookResult,
  registerStripeWebhookEvent
} from "./stripe-event-store";
import { resolveStripeSubscriptionEvent } from "./stripe-subscription";
import { capture } from "#backend/lib/analytics";

const SUBSCRIPTION_EVENTS: Partial<Record<string, string>> = {
  "checkout.session.completed": "subscription_started",
  "customer.subscription.updated": "subscription_changed",
  "customer.subscription.deleted": "subscription_ended"
};

const getItemsKey = (items?: Stripe.ApiList<Stripe.SubscriptionItem>): string => {
  const keys = items?.data.map((item) => `${item.price.id}:${item.quantity ?? 1}`) ?? [];

  return keys.sort().join(",");
};
/** Renewals also update the items (their billing period); only a new price or quantity counts. */
const isPlanChange = (event: Stripe.CustomerSubscriptionUpdatedEvent): boolean => {
  const previousItems = event.data.previous_attributes?.items;

  return (
    Boolean(previousItems) && getItemsKey(previousItems) !== getItemsKey(event.data.object.items)
  );
};
const parseStripeEvent = (
  request: FastifyRequest<{ Body: Buffer }>,
  stripeClient: Stripe,
  webhookSecret: string
): Stripe.Event | "missing-signature" | "invalid-signature" => {
  const signature = request.headers["stripe-signature"];

  if (!signature) return "missing-signature";

  try {
    return stripeClient.webhooks.constructEvent(request.body, signature, webhookSecret);
  } catch {
    return "invalid-signature";
  }
};
const handleStripeWebhook = async (
  request: FastifyRequest<{ Body: Buffer }>,
  reply: FastifyReply
): Promise<void> => {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET) {
    return reply.status(500).send({ error: "Stripe not configured" });
  }

  const event = parseStripeEvent(request, stripe, config.STRIPE_WEBHOOK_SECRET);

  if (event === "missing-signature") {
    return reply.status(400).send({ error: "Missing signature" });
  }
  if (event === "invalid-signature") {
    return reply.status(400).send({ error: "Invalid signature" });
  }

  const alreadyProcessed = await registerStripeWebhookEvent(event);

  if (alreadyProcessed) return reply.status(200).send({ received: true });

  try {
    const result = await resolveStripeSubscriptionEvent(event, stripe);
    const workspaceID = result.workspaceID ? toUUID(result.workspaceID) : null;

    if (workspaceID && result.activeSubscriptionID) {
      const workspace = await getWorkspaceDeletionState(workspaceID);

      if (!workspace || workspace.deletingAt) {
        await Billing.endSubscription({
          subscriptionID: result.activeSubscriptionID,
          idempotencyKey: `deleted-workspace:${result.workspaceID}:${result.activeSubscriptionID}`
        });
      }
    }

    const { revokedInviteIDs } = await persistStripeWebhookResult({
      eventID: event.id,
      workspaceID,
      update: result.update
    });
    const subscriptionEvent = SUBSCRIPTION_EVENTS[event.type];
    const routineUpdate = event.type === "customer.subscription.updated" && !isPlanChange(event);

    if (result.workspaceID && subscriptionEvent && !routineUpdate) {
      capture(subscriptionEvent, {
        workspaceID: result.workspaceID,
        properties: { plan: result.update?.subscriptionPlan }
      });
    }

    if (result.workspaceID && result.update?.subscriptionPlan) {
      await Auth.invalidateSessionData({ workspaceID: result.workspaceID });

      emitWorkspaceStateEvent(result.workspaceID, {
        action: "workspace:update",
        data: {
          id: result.workspaceID,
          subscriptionPlan: result.update.subscriptionPlan
        }
      });

      for (const inviteID of revokedInviteIDs) {
        emitMembershipEvent(result.workspaceID, {
          action: "invite:revoke",
          data: { id: toInviteID(inviteID) }
        });
      }
    }
  } catch (error) {
    await failStripeWebhookEvent(event.id, error);
    request.log.error(error, "Stripe webhook processing failed");
    return reply.status(500).send({ error: "Webhook processing failed" });
  }

  return reply.status(200).send({ received: true });
};

export { handleStripeWebhook };
