// SPDX-License-Identifier: Elastic-2.0
import { type DatabaseTransaction } from "@andesine/server/database";
import { sql } from "drizzle-orm";
import { getUTCMonthPeriod, toUsageDate } from "./usage";

/** Counts the month's usage before an upgrade toward Pro included amounts, once per subscription. */
const carryOverUsage = async (
  tx: DatabaseTransaction,
  workspaceUUID: string,
  subscriptionStart: Date
): Promise<void> => {
  const now = new Date();
  const usageDate = toUsageDate(now);
  const startDate = toUsageDate(getUTCMonthPeriod(now).startDate);

  await tx.execute(sql`
    insert into usage_ledger (workspace_id, usage_date, meter, quantity)
    select
      ${workspaceUUID}::uuid,
      ${usageDate}::date,
      meters.meter::usage_meter,
      meters.quantity - coalesce(ledger.quantity, 0)
    from (
      select
        coalesce(sum(request_count), 0)::bigint as api_calls,
        coalesce(sum(ai_credit_count), 0)::bigint as ai_credits
      from daily_usage
      where workspace_id = ${workspaceUUID}::uuid
        and usage_date between ${startDate}::date and ${usageDate}::date
    ) as totals
    cross join lateral (values ('api-calls', totals.api_calls), ('ai-credits', totals.ai_credits))
      as meters (meter, quantity)
    left join (
      select meter::text, sum(quantity)::bigint as quantity
      from usage_ledger
      where workspace_id = ${workspaceUUID}::uuid
        and usage_date between ${startDate}::date and ${usageDate}::date
        and created_at >= ${subscriptionStart.toISOString()}::timestamptz
      group by meter
    ) as ledger on ledger.meter = meters.meter
    where meters.quantity - coalesce(ledger.quantity, 0) > 0
    on conflict (workspace_id, usage_date, meter) where status = 'pending' do update set
      quantity = usage_ledger.quantity + excluded.quantity,
      updated_at = now()
  `);
};

export { carryOverUsage };
