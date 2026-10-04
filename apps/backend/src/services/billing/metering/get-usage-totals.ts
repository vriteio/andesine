// SPDX-License-Identifier: Elastic-2.0
import { dailyUsage } from "@andesine/server/database";
import {
  getEffectivePlan,
  getSpendingLimit,
  getUsageCounterKey,
  getUTCMonthPeriod,
  loadUsageCounters,
  readUsageCounters,
  toUsageDate,
  type UsageCounters
} from "#backend/lib/billing";
import { config } from "#backend/lib/config";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { and, eq, gte, lte, sum } from "drizzle-orm";

interface MeterTotal {
  total: number;
  /** The hard limit on Free, or the included amount on Pro. */
  limit: number;
}

interface UsageTotals {
  apiCalls: MeterTotal;
  aiCredits: MeterTotal;
  /** In cents. */
  spendingLimit: number | null;
  resetDate: Date;
}

const loadCounters = async (
  workspaceUUID: string,
  startDate: Date,
  endDate: Date
): Promise<UsageCounters> => {
  const [spendingLimit, [row]] = await Promise.all([
    getSpendingLimit(workspaceUUID),
    db
      .select({ apiCalls: sum(dailyUsage.requestCount), aiCredits: sum(dailyUsage.aiCreditCount) })
      .from(dailyUsage)
      .where(
        and(
          eq(dailyUsage.workspaceID, workspaceUUID),
          gte(dailyUsage.usageDate, toUsageDate(startDate)),
          lte(dailyUsage.usageDate, toUsageDate(endDate))
        )
      )
  ]);

  return {
    apiCalls: Number(row?.apiCalls ?? 0),
    aiCredits: Number(row?.aiCredits ?? 0),
    spendingLimit
  };
};

const getUsageTotals = async (input: {
  workspaceID: string;
  plan: string;
}): Promise<UsageTotals> => {
  const now = new Date();
  const workspaceUUID = toUUID(input.workspaceID);
  const period = getUTCMonthPeriod(now);
  const key = getUsageCounterKey(workspaceUUID, now);
  const isPro = getEffectivePlan(input.plan) === "pro";

  let counters = await readUsageCounters(key);

  if (!counters) {
    const loaded = await loadCounters(workspaceUUID, period.startDate, period.endDate);

    await loadUsageCounters(key, loaded);
    counters = (await readUsageCounters(key)) ?? loaded;
  }

  return {
    apiCalls: {
      total: counters.apiCalls,
      limit: isPro ? config.PRO_INCLUDED_API_CALLS : config.INCLUDED_API_CALLS
    },
    aiCredits: {
      total: counters.aiCredits,
      limit: isPro ? config.PRO_INCLUDED_AI_CREDITS : config.INCLUDED_AI_CREDITS
    },
    spendingLimit: counters.spendingLimit,
    resetDate: period.resetDate
  };
};

export { getUsageTotals };
export type { UsageTotals };
