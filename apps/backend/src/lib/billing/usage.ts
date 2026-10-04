// SPDX-License-Identifier: Elastic-2.0
import { redis } from "#backend/lib/adapters/redis";

interface UsageCounts {
  apiCalls: number;
  aiCredits: number;
}

interface UsageCounters extends UsageCounts {
  spendingLimit: number | null;
}

// Reloads from Postgres limit drift from concurrent loads.
const USAGE_COUNTERS_TTL = 5 * 60;

// Missing counters stay missing, so the next load from Postgres includes this usage.
const INCREMENT_LOADED_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 1 then
  redis.call("HINCRBY", KEYS[1], "apiCalls", ARGV[1])
  redis.call("HINCRBY", KEYS[1], "aiCredits", ARGV[2])
end
return 1
`;

const getUTCMonthPeriod = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startDate = new Date(Date.UTC(year, month, 1));
  const resetDate = new Date(Date.UTC(year, month + 1, 1));

  return {
    daysInMonth: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
    endDate: new Date(resetDate.getTime() - 1),
    resetDate,
    startDate
  };
};
const toUsageDate = (date: Date): string => date.toISOString().slice(0, 10);
/** Keeps late reports in the billing period of the usage day. */
const toMeterEventTimestamp = (usageDate: string): string => {
  const endOfDay = new Date(`${usageDate}T23:59:59.999Z`).getTime();

  return new Date(Math.min(endOfDay, Date.now())).toISOString();
};
const getUsageCounterKey = (workspaceUUID: string, date: Date): string => {
  return `usage:${workspaceUUID}:${toUsageDate(date).slice(0, 7)}`;
};
const readUsageCounters = async (key: string): Promise<UsageCounters | null> => {
  const counters = await redis.hGetAll(key);
  const isLoaded =
    counters.apiCalls !== undefined &&
    counters.aiCredits !== undefined &&
    counters.spendingLimit !== undefined;

  if (!isLoaded) return null;

  return {
    apiCalls: Number(counters.apiCalls),
    aiCredits: Number(counters.aiCredits),
    spendingLimit: counters.spendingLimit ? Number(counters.spendingLimit) : null
  };
};
const loadUsageCounters = async (key: string, counters: UsageCounters): Promise<void> => {
  await redis
    .multi()
    .hSetNX(key, "apiCalls", `${counters.apiCalls}`)
    .hSetNX(key, "aiCredits", `${counters.aiCredits}`)
    .hSetNX(key, "spendingLimit", `${counters.spendingLimit ?? ""}`)
    .expire(key, USAGE_COUNTERS_TTL, "NX")
    .exec();
};
const incrementUsageCounters = async (key: string, counts: UsageCounts): Promise<void> => {
  await redis.eval(INCREMENT_LOADED_SCRIPT, {
    keys: [key],
    arguments: [`${counts.apiCalls}`, `${counts.aiCredits}`]
  });
};
const dropUsageCounters = async (key: string): Promise<void> => {
  await redis.del(key);
};

export {
  dropUsageCounters,
  getUTCMonthPeriod,
  getUsageCounterKey,
  incrementUsageCounters,
  loadUsageCounters,
  readUsageCounters,
  toMeterEventTimestamp,
  toUsageDate
};
export type { UsageCounters, UsageCounts };
