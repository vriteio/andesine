import { type WebhookRun } from "@andesine/contracts/webhooks";
import { type Page } from "#backend/lib/api/pagination";
import { getExtensionWebhookHistoryScope } from "#backend/lib/extensions/webhook-history";
import { withAuthorization } from "#backend/lib/policy";
import { listWebhookRunPage } from "#backend/lib/webhooks/history/pages";

interface ListRunsInput {
  extensionID: string;
  webhookID: string;
  deliveryID: string;
  cursor?: string;
  limit: number;
}

const listRuns = withAuthorization<ListRunsInput, undefined, Page<WebhookRun>>(
  { permissions: { session: ["extensions"] }, transaction: "snapshot" },
  async ({ auth, database, input, workspaceID }) => {
    const { extensionID, webhookID, ...page } = input;
    const scope = await getExtensionWebhookHistoryScope(database, auth, workspaceID, {
      extensionID,
      webhookID
    });

    return listWebhookRunPage(database, { ...page, ...scope });
  }
);

export { listRuns };
