import {
  outboundDeliveries,
  outboundDeliveryAttempts,
  outboundDeliveryRuns,
  outboundEvents,
  type DatabaseClient
} from "@andesine/server/database";
import { loadWebhookEndpoint } from "@andesine/server/webhooks/recording";
import {
  type OutboundEvent,
  type OutboundEventName,
  type WebhookAttempt,
  type WebhookAttemptListInput,
  type WebhookDelivery,
  type WebhookDeliveryInput,
  type WebhookDeliveryListInput,
  type WebhookRun,
  type WebhookRunListInput
} from "@andesine/contracts/webhooks";
import { toPage, type Page } from "#backend/lib/api/pagination";
import type { SessionData } from "#backend/lib/policy/session";
import { toUUID } from "@andesine/contracts/primitives";
import { and, desc, eq, getTableColumns, gt, lt, or } from "drizzle-orm";
import { describeWebhookAttempt, describeWebhookDeliveries, describeWebhookRuns } from "./describe";
import { readRetainedWebhookPayload } from "./payload";
import { loadWebhookAttempt, loadWebhookDelivery, loadWebhookRun } from "./records";

// Shared by the Webhooks API and the extension webhook views; services authorize first.
interface HistoryScope {
  workspaceID: string;
  now: Date;
  /** The extension's UUID, for its managed webhooks. */
  extensionID?: string;
}
interface PageScope extends HistoryScope {
  limit: number;
}
interface DeliveryListInput extends Omit<WebhookDeliveryListInput, "type" | "limit">, PageScope {
  type?: OutboundEventName;
}
interface DeliveryDetails {
  delivery: WebhookDelivery;
  payload: { availability: "available"; event: OutboundEvent } | { availability: "forbidden" };
  currentRun: WebhookRun | null;
}

const listWebhookDeliveryPage = async (
  database: DatabaseClient,
  page: DeliveryListInput
): Promise<Page<WebhookDelivery>> => {
  const { workspaceID, now, extensionID } = page;

  await loadWebhookEndpoint(database, {
    workspaceID,
    id: page.id,
    includeDeleted: true,
    extensionID
  });

  const cursor = page.cursor
    ? await loadWebhookDelivery(database, {
        workspaceID,
        id: page.id,
        deliveryID: page.cursor,
        now,
        extensionID
      })
    : null;
  const { payload: _payload, ...columns } = getTableColumns(outboundDeliveries);
  const rows = await database
    .select({
      delivery: columns,
      event: {
        type: outboundEvents.type,
        occurredAt: outboundEvents.occurredAt,
        test: outboundEvents.test
      }
    })
    .from(outboundDeliveries)
    .innerJoin(
      outboundEvents,
      and(
        eq(outboundEvents.workspaceID, outboundDeliveries.workspaceID),
        eq(outboundEvents.id, outboundDeliveries.eventID)
      )
    )
    .where(
      and(
        eq(outboundDeliveries.workspaceID, toUUID(workspaceID)),
        eq(outboundDeliveries.endpointID, toUUID(page.id)),
        gt(outboundDeliveries.expiresAt, now),
        page.type ? eq(outboundEvents.type, page.type) : undefined,
        page.state ? eq(outboundDeliveries.state, page.state) : undefined,
        page.createdAfter
          ? gt(outboundDeliveries.createdAt, new Date(page.createdAfter))
          : undefined,
        page.createdBefore
          ? lt(outboundDeliveries.createdAt, new Date(page.createdBefore))
          : undefined,
        cursor
          ? or(
              lt(outboundDeliveries.createdAt, cursor.createdAt),
              and(
                eq(outboundDeliveries.createdAt, cursor.createdAt),
                lt(outboundDeliveries.id, cursor.id)
              )
            )
          : undefined
      )
    )
    .orderBy(desc(outboundDeliveries.createdAt), desc(outboundDeliveries.id))
    .limit(page.limit + 1);

  return toPage(await describeWebhookDeliveries(database, rows), page.limit);
};
/** A retained delivery with its payload, when the member can read it, and its current run. */
const getWebhookDeliveryDetails = async (
  database: DatabaseClient,
  auth: SessionData,
  identity: WebhookDeliveryInput & HistoryScope
): Promise<DeliveryDetails> => {
  const row = await loadWebhookDelivery(database, identity);
  const { event, allowed } = await readRetainedWebhookPayload(database, auth, row);
  const [delivery] = await describeWebhookDeliveries(database, [
    {
      delivery: row,
      event: { type: event.type, test: event.test, occurredAt: new Date(event.occurredAt) }
    }
  ]);
  const runs = delivery!.currentRunID
    ? await describeWebhookRuns(database, [
        await loadWebhookRun(database, { ...identity, runID: delivery!.currentRunID })
      ])
    : [];

  return {
    delivery: delivery!,
    payload: allowed ? { availability: "available", event } : { availability: "forbidden" },
    currentRun: runs[0] ?? null
  };
};
const listWebhookRunPage = async (
  database: DatabaseClient,
  page: WebhookRunListInput & PageScope
): Promise<Page<WebhookRun>> => {
  await loadWebhookDelivery(database, page);

  const cursor = page.cursor
    ? await loadWebhookRun(database, { ...page, runID: page.cursor })
    : null;
  const rows = await database
    .select()
    .from(outboundDeliveryRuns)
    .where(
      and(
        eq(outboundDeliveryRuns.workspaceID, toUUID(page.workspaceID)),
        eq(outboundDeliveryRuns.endpointID, toUUID(page.id)),
        eq(outboundDeliveryRuns.deliveryID, toUUID(page.deliveryID)),
        cursor ? lt(outboundDeliveryRuns.number, cursor.number) : undefined
      )
    )
    .orderBy(desc(outboundDeliveryRuns.number))
    .limit(page.limit + 1);

  return toPage(await describeWebhookRuns(database, rows), page.limit);
};
const listWebhookAttemptPage = async (
  database: DatabaseClient,
  page: WebhookAttemptListInput & PageScope
): Promise<Page<WebhookAttempt>> => {
  await loadWebhookDelivery(database, page);
  await loadWebhookRun(database, page);

  const cursor = page.cursor
    ? await loadWebhookAttempt(database, { ...page, attemptID: page.cursor })
    : null;
  const rows = await database
    .select()
    .from(outboundDeliveryAttempts)
    .where(
      and(
        eq(outboundDeliveryAttempts.workspaceID, toUUID(page.workspaceID)),
        eq(outboundDeliveryAttempts.runID, toUUID(page.runID)),
        cursor ? lt(outboundDeliveryAttempts.number, cursor.number) : undefined
      )
    )
    .orderBy(desc(outboundDeliveryAttempts.number))
    .limit(page.limit + 1);

  return toPage(rows.map(describeWebhookAttempt), page.limit);
};

export {
  listWebhookDeliveryPage,
  getWebhookDeliveryDetails,
  listWebhookRunPage,
  listWebhookAttemptPage
};
export type { DeliveryDetails };
