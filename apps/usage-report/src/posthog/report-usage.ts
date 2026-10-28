// SPDX-License-Identifier: Elastic-2.0
import { toWorkspaceID } from "@andesine/contracts/primitives";
import { config } from "../config";
import { pool } from "../database";
import { captureBatch, type PostHogEvent } from "./capture";
import { toEventUUID } from "./uuid";

interface CursorRow {
  reported_through: string;
}
interface EarliestUsageRow {
  usage_date: string | null;
}
interface DailyUsageRow {
  workspace_id: string;
  request_count: string;
  mcp_request_count: string;
  ai_credit_count: string;
}

const BATCH_SIZE = 500;
const MAX_BACKFILL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const toUsageDate = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (usageDate: string, days: number): string => {
  return toUsageDate(new Date(Date.parse(`${usageDate}T00:00:00.000Z`) + days * DAY_MS));
};
/** The day after the cursor or, on the first run, the earliest usage within the backfill window. */
const getStartDate = async (yesterday: string): Promise<string | null> => {
  const cursor = await pool.query<CursorRow>(
    "select reported_through::text as reported_through from analytics_usage_cursor where id = 1"
  );
  const reportedThrough = cursor.rows[0]?.reported_through;

  if (reportedThrough) return addDays(reportedThrough, 1);

  const earliest = await pool.query<EarliestUsageRow>(
    "select min(usage_date)::text as usage_date from daily_usage"
  );
  const earliestDate = earliest.rows[0]?.usage_date;
  const backfillStart = addDays(yesterday, 1 - MAX_BACKFILL_DAYS);

  if (!earliestDate) return null;

  return earliestDate > backfillStart ? earliestDate : backfillStart;
};
const toDailyUsageEvent = (row: DailyUsageRow, usageDate: string): PostHogEvent => {
  const workspaceID = toWorkspaceID(row.workspace_id);

  return {
    event: "workspace_daily_usage",
    distinct_id: workspaceID,
    uuid: toEventUUID(`${row.workspace_id}:${usageDate}`),
    timestamp: `${usageDate}T23:59:59.999Z`,
    properties: {
      api_calls: Number(row.request_count),
      mcp_calls: Number(row.mcp_request_count),
      ai_credits: Number(row.ai_credit_count),
      usage_date: usageDate,
      $groups: { workspace: workspaceID },
      $process_person_profile: false
    }
  };
};
const reportDay = async (usageDate: string): Promise<number> => {
  const usage = await pool.query<DailyUsageRow>(
    `
      select workspace_id, request_count, mcp_request_count, ai_credit_count
      from daily_usage
      where usage_date = $1
      order by workspace_id
    `,
    [usageDate]
  );
  const events = usage.rows.map((row) => toDailyUsageEvent(row, usageDate));

  for (let index = 0; index < events.length; index += BATCH_SIZE) {
    await captureBatch(events.slice(index, index + BATCH_SIZE));
  }

  await pool.query(
    `
      insert into analytics_usage_cursor (id, reported_through)
      values (1, $1)
      on conflict (id) do update set
        reported_through = excluded.reported_through,
        updated_at = now()
    `,
    [usageDate]
  );

  return events.length;
};

/** Sends daily usage of complete UTC days to PostHog, or returns null when PostHog is not set. */
const reportPostHogUsage = async (): Promise<number | null> => {
  if (!config.PUBLIC_POSTHOG_KEY || !config.POSTHOG_HOST) return null;

  const yesterday = addDays(toUsageDate(new Date()), -1);
  const startDate = await getStartDate(yesterday);

  if (!startDate) return 0;

  let reportedCount = 0;

  for (let usageDate = startDate; usageDate <= yesterday; usageDate = addDays(usageDate, 1)) {
    reportedCount += await reportDay(usageDate);
  }

  return reportedCount;
};

export { reportPostHogUsage };
