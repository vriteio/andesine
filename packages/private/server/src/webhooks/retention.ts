interface WebhookRetentionPolicy {
  billingEnabled: boolean;
  freeDays: number;
  proDays: number;
}

interface WebhookRetentionConfig {
  BILLING_ENABLED: boolean;
  VERSION_RETENTION_DAYS: number;
  PRO_VERSION_RETENTION_DAYS: number;
}

interface WebhookDeliveryRetention {
  createdAt: Date;
  retentionDays: number;
  expiresAt: Date;
}

const createWebhookRetentionPolicy = (config: WebhookRetentionConfig): WebhookRetentionPolicy => {
  return {
    billingEnabled: config.BILLING_ENABLED,
    freeDays: config.VERSION_RETENTION_DAYS,
    proDays: config.PRO_VERSION_RETENTION_DAYS
  };
};
// Call once when the original delivery is recorded, then persist all three fields.
// Replays read the stored expiresAt; they must not recalculate it from current policy.
const getWebhookDeliveryRetention = (
  subscriptionPlan: string,
  createdAt: Date,
  policy: WebhookRetentionPolicy
): WebhookDeliveryRetention => {
  const retentionDays =
    !policy.billingEnabled || subscriptionPlan === "pro" ? policy.proDays : policy.freeDays;
  const expiresAt = new Date(createdAt.getTime() + retentionDays * 86_400_000);

  if (!Number.isFinite(expiresAt.getTime())) {
    throw new RangeError("Webhook delivery expiry must be a valid date");
  }

  return { createdAt: new Date(createdAt), retentionDays, expiresAt };
};

export { createWebhookRetentionPolicy, getWebhookDeliveryRetention };
export type { WebhookRetentionPolicy, WebhookRetentionConfig, WebhookDeliveryRetention };
