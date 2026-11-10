import { sendWebhookTest } from "./send-test";
import { listWebhookDeliveries } from "./list-deliveries";
import { getWebhookDelivery } from "./get-delivery";
import { listWebhookRuns } from "./list-runs";
import { listWebhookAttempts } from "./list-attempts";
import { redeliverWebhook } from "./redeliver";
import { bulkRedeliverWebhook } from "./bulk-redeliver";
import { listWebhooks } from "./list";
import { getWebhook } from "./get";
import { createWebhook } from "./create";
import { updateWebhook } from "./update";
import { deleteWebhook } from "./delete";
import { bulkSetWebhooksEnabled } from "./bulk-set-enabled";
import { bulkDeleteWebhooks } from "./bulk-delete";
import { rotateWebhookSecret } from "./rotate-secret";

const WebhooksService = {
  sendTest: sendWebhookTest,
  listDeliveries: listWebhookDeliveries,
  getDelivery: getWebhookDelivery,
  listRuns: listWebhookRuns,
  listAttempts: listWebhookAttempts,
  redeliver: redeliverWebhook,
  bulkRedeliver: bulkRedeliverWebhook,

  list: listWebhooks,
  get: getWebhook,
  create: createWebhook,
  update: updateWebhook,
  delete: deleteWebhook,
  bulkSetEnabled: bulkSetWebhooksEnabled,
  bulkDelete: bulkDeleteWebhooks,
  rotateSecret: rotateWebhookSecret
};

export { WebhooksService };
