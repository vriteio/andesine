// SPDX-License-Identifier: Elastic-2.0
import {
  getPeriodStart,
  getUsageCounterKey,
  incrementUsageCounters,
  seatCountSQL,
  toUsageDate
} from "#backend/lib/billing";
import { config } from "#backend/lib/config";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

interface RecordUsageInput {
  workspaceID: string;
  apiCalls: number;
  mcpCalls: number;
  aiCredits: number;
}

const recordUsage = async (input: RecordUsageInput): Promise<void> => {
  const now = new Date();
  const workspaceUUID = toUUID(input.workspaceID);
  const usageDate = toUsageDate(now);
  const hasUsage = Boolean(input.apiCalls || input.aiCredits);

  if (!config.BILLING_ENABLED || !hasUsage) return;

  const result = await db.execute<{ recorded: number }>(sql`
    with workspace as (
      select id, subscription_plan
      from workspaces
      where id = ${workspaceUUID}::uuid and deleting_at is null
      -- Waits for plan changes, so the usage is billed by the plan it lands in.
      for share
    ),
    daily as (
      insert into daily_usage (
        workspace_id, usage_date, request_count, mcp_request_count, ai_credit_count
      )
      select id, ${usageDate}::date, ${input.apiCalls}, ${input.mcpCalls}, ${input.aiCredits}
      from workspace
      on conflict (workspace_id, usage_date) do update set
        request_count = daily_usage.request_count + excluded.request_count,
        mcp_request_count = daily_usage.mcp_request_count + excluded.mcp_request_count,
        ai_credit_count = daily_usage.ai_credit_count + excluded.ai_credit_count
    ),
    -- The atomic increment returns the totals with this usage, for an exact overage.
    period as (
      insert into billing_periods (workspace_id, period_start, api_calls, ai_credits, seats)
      select
        id,
        ${getPeriodStart(now)}::date,
        ${input.apiCalls},
        ${input.aiCredits},
        ${seatCountSQL(workspaceUUID)}
      from workspace
      on conflict (workspace_id, period_start) do update set
        api_calls = billing_periods.api_calls + excluded.api_calls,
        ai_credits = billing_periods.ai_credits + excluded.ai_credits,
        seats = greatest(billing_periods.seats, excluded.seats)
      returning api_calls, ai_credits, greatest(seats, 1) as seats
    ),
    -- Only the usage over the pool is billed.
    overage as (
      select
        greatest(period.api_calls - pool.api_calls, 0)
          - greatest(period.api_calls - ${input.apiCalls} - pool.api_calls, 0) as api_calls,
        greatest(period.ai_credits - pool.ai_credits, 0)
          - greatest(period.ai_credits - ${input.aiCredits} - pool.ai_credits, 0) as ai_credits
      from period, lateral (
        select
          period.seats * ${config.PRO_API_CALLS_PER_SEAT}::bigint as api_calls,
          period.seats * ${config.PRO_AI_CREDITS_PER_SEAT}::bigint as ai_credits
      ) as pool
    ),
    ledger as (
      insert into usage_ledger (workspace_id, usage_date, meter, quantity)
      select workspace.id, ${usageDate}::date, meters.meter::usage_meter, meters.quantity
      from workspace, overage, lateral (
        values ('api-calls', overage.api_calls), ('ai-credits', overage.ai_credits)
      ) as meters (meter, quantity)
      where workspace.subscription_plan = 'pro' and meters.quantity > 0
      on conflict (workspace_id, usage_date, meter) where status = 'pending' do update set
        quantity = usage_ledger.quantity + excluded.quantity,
        updated_at = now()
    )
    select count(*)::int as recorded from workspace
  `);

  if (!result.rows[0]?.recorded) {
    throw new ORPCError("CONFLICT", { message: "Workspace not found or deletion is in progress" });
  }

  await incrementUsageCounters(getUsageCounterKey(workspaceUUID, now), input);
};

export { recordUsage };
