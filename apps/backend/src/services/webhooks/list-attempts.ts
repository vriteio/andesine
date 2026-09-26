import { outboundDeliveryAttempts } from "@andesine/server/database";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  webhookAttemptListInputType,
  type WebhookAttemptListInput,
  type WebhookAttempt,
  webhookReadRequirements
} from "@andesine/contracts/webhooks";
import { toPage, type Page } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { describeWebhookAttempt } from "#backend/lib/webhooks/history/describe";
import {
  loadWebhookDelivery,
  loadWebhookRun,
  loadWebhookAttempt
} from "#backend/lib/webhooks/history/records";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { and, desc, eq, lt } from "drizzle-orm";

const listWebhookAttempts = withAuthorization<
  WebhookAttemptListInput,
  undefined,
  Page<WebhookAttempt>
>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const page = parseWebhookInput(webhookAttemptListInputType, input);
    const now = await getDeliveryTime(database);
    const identity = { ...page, workspaceID: auth.workspaceID, now };

    await loadWebhookDelivery(database, identity);
    await loadWebhookRun(database, identity);

    const cursor = page.cursor
      ? await loadWebhookAttempt(database, { ...identity, attemptID: page.cursor })
      : null;
    const rows = await database
      .select()
      .from(outboundDeliveryAttempts)
      .where(
        and(
          eq(outboundDeliveryAttempts.workspaceID, toUUID(auth.workspaceID)),
          eq(outboundDeliveryAttempts.runID, toUUID(page.runID)),
          cursor ? lt(outboundDeliveryAttempts.number, cursor.number) : undefined
        )
      )
      .orderBy(desc(outboundDeliveryAttempts.number))
      .limit(page.limit + 1);

    return toPage(rows.map(describeWebhookAttempt), page.limit);
  }
);

export { listWebhookAttempts };
