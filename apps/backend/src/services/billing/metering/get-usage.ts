import { dailyUsage } from "@andesine/server/database";
// SPDX-License-Identifier: Elastic-2.0
import {
  estimateCharges,
  getEffectivePlan,
  getMeterPrices,
  getSpendingLimit,
  getUTCMonthPeriod,
  toUsageDate,
  type MeterCharges
} from "#backend/lib/billing";
import { config } from "#backend/lib/config";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { and, asc, eq, gte, lte } from "drizzle-orm";

interface DailyUsageRecord {
  day: number;
  count: number;
}

interface MeterUsage {
  daily: DailyUsageRecord[];
  total: number;
  /** The hard limit on Free, or the included amount on Pro. */
  limit: number;
}

interface SpendingData {
  /** In cents. */
  limit: number | null;
  /** `null` when prices are unavailable. */
  estimated: MeterCharges | null;
  currency: string | null;
}

interface UsageData {
  apiCalls: MeterUsage;
  aiCredits: MeterUsage;
  spending: SpendingData | null;
  startDate: Date;
  endDate: Date;
  resetDate: Date;
}

const toMeterUsage = (
  counts: Map<number, number>,
  daysInMonth: number,
  limit: number
): MeterUsage => {
  const daily = Array.from({ length: daysInMonth }, (_, index) => {
    return { day: index + 1, count: counts.get(index + 1) ?? 0 };
  });

  return { daily, total: daily.reduce((sum, { count }) => sum + count, 0), limit };
};

const getUsage = async (input: {
  workspaceID: string;
  plan: string;
  date?: Date;
}): Promise<UsageData> => {
  const now = new Date();
  const targetDate = input.date || now;
  const period = getUTCMonthPeriod(targetDate);
  const isCurrentMonth =
    targetDate.getUTCFullYear() === now.getUTCFullYear() &&
    targetDate.getUTCMonth() === now.getUTCMonth();
  const isPro = getEffectivePlan(input.plan) === "pro";
  const rows = await db
    .select()
    .from(dailyUsage)
    .where(
      and(
        eq(dailyUsage.workspaceID, toUUID(input.workspaceID)),
        gte(dailyUsage.usageDate, toUsageDate(period.startDate)),
        lte(dailyUsage.usageDate, toUsageDate(period.endDate))
      )
    )
    .orderBy(asc(dailyUsage.usageDate));
  const toCounts = (count: (row: (typeof rows)[number]) => number) => {
    return new Map(rows.map((row) => [Number(row.usageDate.slice(-2)), count(row)]));
  };

  const apiCalls = toMeterUsage(
    toCounts((row) => row.requestCount),
    period.daysInMonth,
    isPro ? config.PRO_INCLUDED_API_CALLS : config.INCLUDED_API_CALLS
  );
  const aiCredits = toMeterUsage(
    toCounts((row) => row.aiCreditCount),
    period.daysInMonth,
    isPro ? config.PRO_INCLUDED_AI_CREDITS : config.INCLUDED_AI_CREDITS
  );
  const getSpending = async (): Promise<SpendingData | null> => {
    if (!isPro || !config.BILLING_ENABLED) return null;

    const [limit, prices] = await Promise.all([
      getSpendingLimit(toUUID(input.workspaceID)),
      getMeterPrices().catch(() => null)
    ]);

    return {
      limit,
      estimated: prices && estimateCharges({ apiCalls, aiCredits }, prices),
      currency: prices?.currency ?? null
    };
  };

  return {
    apiCalls,
    aiCredits,
    spending: await getSpending(),
    startDate: period.startDate,
    endDate: isCurrentMonth ? now : period.endDate,
    resetDate: period.resetDate
  };
};

export { getUsage };
