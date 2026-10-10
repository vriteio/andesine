import { type WebhookAttempt } from "@andesine/contracts/webhooks";
import { type Page } from "#backend/lib/api/pagination";
import { getExtensionWebhookHistoryScope } from "#backend/lib/extensions/webhook-history";
import { withAuthorization } from "#backend/lib/policy";
import { listWebhookAttemptPage } from "#backend/lib/webhooks/history/pages";

interface ListAttemptsInput {
  extensionID: string;
  webhookID: string;
  deliveryID: string;
  runID: string;
  cursor?: string;
  limit: number;
}

const listAttempts = withAuthorization<ListAttemptsInput, undefined, Page<WebhookAttempt>>(
  { permissions: { session: ["extensions"] }, transaction: "snapshot" },
  async ({ auth, database, input, workspaceID }) => {
    const { extensionID, webhookID, ...page } = input;
    const scope = await getExtensionWebhookHistoryScope(database, auth, workspaceID, {
      extensionID,
      webhookID
    });

    return listWebhookAttemptPage(database, { ...page, ...scope });
  }
);

export { listAttempts };
