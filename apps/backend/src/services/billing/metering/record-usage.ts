// SPDX-License-Identifier: Elastic-2.0
import { getUsageCounterKey, incrementUsageCounters, toUsageDate } from "#backend/lib/billing";
import { config } from "#backend/lib/config";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

interface RecordUsageInput {
  workspaceID: string;
  apiCalls: number;
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
      -- Waits for plan changes, so the upgrade carry-over counts this usage once.
      for share
    ),
    daily as (
      insert into daily_usage (workspace_id, usage_date, request_count, ai_credit_count)
      select id, ${usageDate}::date, ${input.apiCalls}, ${input.aiCredits}
      from workspace
      on conflict (workspace_id, usage_date) do update set
        request_count = daily_usage.request_count + excluded.request_count,
        ai_credit_count = daily_usage.ai_credit_count + excluded.ai_credit_count
    ),
    ledger as (
      insert into usage_ledger (workspace_id, usage_date, meter, quantity)
      select workspace.id, ${usageDate}::date, meters.meter::usage_meter, meters.quantity
      from workspace, (
        values ('api-calls', ${input.apiCalls}::bigint), ('ai-credits', ${input.aiCredits}::bigint)
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
