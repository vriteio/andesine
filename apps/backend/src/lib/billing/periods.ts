// SPDX-License-Identifier: Elastic-2.0
import { billingPeriods, type DatabaseTransaction, memberships } from "@andesine/server/database";
import { db } from "#backend/lib/adapters/postgres";
import { config } from "#backend/lib/config";
import { and, count, eq, sql } from "drizzle-orm";
import { getUTCMonthPeriod, toUsageDate, type UsageCounts } from "./usage";

/** The plan's monthly usage: Free's hard limits, or Pro's pool of the period's seats. */
const getIncludedUsage = (plan: string, seats: number): UsageCounts => {
  if (plan !== "pro") {
    return { apiCalls: config.INCLUDED_API_CALLS, aiCredits: config.INCLUDED_AI_CREDITS };
  }

  const paidSeats = Math.max(seats, 1);

  return {
    apiCalls: paidSeats * config.PRO_API_CALLS_PER_SEAT,
    aiCredits: paidSeats * config.PRO_AI_CREDITS_PER_SEAT
  };
};
const getPeriodStart = (date: Date): string => toUsageDate(getUTCMonthPeriod(date).startDate);
const seatCountSQL = (workspaceUUID: string) => {
  return sql`(select count(*)::int from ${memberships} where ${memberships.workspaceID} = ${workspaceUUID}::uuid)`;
};
/** Raises the period's highest seat count to the current one. */
const recordPeriodSeats = async (
  executor: DatabaseTransaction | typeof db,
  workspaceUUID: string
): Promise<void> => {
  await executor.execute(sql`
    insert into ${billingPeriods} (workspace_id, period_start, seats)
    values (${workspaceUUID}::uuid, ${getPeriodStart(new Date())}::date, ${seatCountSQL(workspaceUUID)})
    on conflict (workspace_id, period_start) do update set
      seats = greatest(${billingPeriods.seats}, excluded.seats)
  `);
};
/** The period's highest seat count; for the current period, at least the current count. */
const getPeriodSeats = async (workspaceUUID: string, date: Date): Promise<number> => {
  const periodStart = getPeriodStart(date);
  const isCurrent = periodStart === getPeriodStart(new Date());
  const [[period], current] = await Promise.all([
    db
      .select({ seats: billingPeriods.seats })
      .from(billingPeriods)
      .where(
        and(
          eq(billingPeriods.workspaceID, workspaceUUID),
          eq(billingPeriods.periodStart, periodStart)
        )
      ),
    isCurrent
      ? db
          .select({ value: count() })
          .from(memberships)
          .where(eq(memberships.workspaceID, workspaceUUID))
      : []
  ]);

  return Math.max(period?.seats ?? 0, current[0]?.value ?? 0);
};

export { getIncludedUsage, getPeriodSeats, getPeriodStart, recordPeriodSeats, seatCountSQL };
