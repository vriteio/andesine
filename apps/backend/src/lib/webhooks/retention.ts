import { getEffectivePlan } from "#backend/lib/billing";
import { config } from "#backend/lib/config";

interface WebhookDeliveryRetention {
  createdAt: Date;
  retentionDays: number;
  expiresAt: Date;
}

// Call once when the original delivery is recorded, then persist all three fields.
// Replays read the stored expiresAt; they must not recalculate it from current policy.
const getWebhookDeliveryRetention = (
  subscriptionPlan: string,
  createdAt: Date
): WebhookDeliveryRetention => {
  const retentionDays =
    getEffectivePlan(subscriptionPlan) === "pro"
      ? config.PRO_VERSION_RETENTION_DAYS
      : config.VERSION_RETENTION_DAYS;
  const expiresAt = new Date(createdAt.getTime() + retentionDays * 86_400_000);

  if (!Number.isFinite(expiresAt.getTime())) {
    throw new RangeError("Webhook delivery expiry must be a valid date");
  }

  return { createdAt: new Date(createdAt), retentionDays, expiresAt };
};

export { getWebhookDeliveryRetention };
export type { WebhookDeliveryRetention };
