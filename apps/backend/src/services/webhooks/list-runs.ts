import { outboundDeliveryRuns } from "@andesine/server/database";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  webhookRunListInputType,
  type WebhookRunListInput,
  type WebhookRun,
  webhookReadRequirements
} from "@andesine/contracts/webhooks";
import { toPage, type Page } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { describeWebhookRuns } from "#backend/lib/webhooks/history/describe";
import { loadWebhookDelivery, loadWebhookRun } from "#backend/lib/webhooks/history/records";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { and, desc, eq, lt } from "drizzle-orm";

const listWebhookRuns = withAuthorization<WebhookRunListInput, undefined, Page<WebhookRun>>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const page = parseWebhookInput(webhookRunListInputType, input);
    const now = await getDeliveryTime(database);
    const identity = { ...page, workspaceID: auth.workspaceID, now };

    await loadWebhookDelivery(database, identity);

    const cursor = page.cursor
      ? await loadWebhookRun(database, { ...identity, runID: page.cursor })
      : null;
    const rows = await database
      .select()
      .from(outboundDeliveryRuns)
      .where(
        and(
          eq(outboundDeliveryRuns.workspaceID, toUUID(auth.workspaceID)),
          eq(outboundDeliveryRuns.endpointID, toUUID(page.id)),
          eq(outboundDeliveryRuns.deliveryID, toUUID(page.deliveryID)),
          cursor ? lt(outboundDeliveryRuns.number, cursor.number) : undefined
        )
      )
      .orderBy(desc(outboundDeliveryRuns.number))
      .limit(page.limit + 1);

    return toPage(await describeWebhookRuns(database, rows), page.limit);
  }
);

export { listWebhookRuns };
