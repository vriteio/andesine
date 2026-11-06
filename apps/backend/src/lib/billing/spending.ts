// SPDX-License-Identifier: Elastic-2.0
import { workspaces } from "@andesine/server/database";
import { db } from "#backend/lib/adapters/postgres";
import { stripe } from "#backend/lib/adapters/stripe";
import { config } from "#backend/lib/config";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

interface MeterPrice {
  /** In cents, for each package of units. */
  amount: number;
  /** Units in a package, e.g. 50K API calls; 1 without a package. */
  size: number;
  round: "up" | "down";
}

interface MeterPrices {
  /** Prices over the pool. */
  apiCalls: MeterPrice;
  aiCredits: MeterPrice;
  currency: string;
}

/** In cents. */
interface MeterCharges {
  apiCalls: number;
  aiCredits: number;
}

interface MeterOverage {
  total: number;
  limit: number;
}

interface MeterOverages {
  apiCalls: MeterOverage;
  aiCredits: MeterOverage;
}

interface CachedPrices {
  prices: Promise<MeterPrices | null>;
  expiresAt: number;
}

const PRICE_CACHE_TTL = 60 * 60 * 1000;
const PRICE_FAILURE_TTL = 60 * 1000;

let cachedPrices: CachedPrices | null = null;

/** Usage over the pool is billed per unit or package, e.g. $1 per 50K API calls. */
const toMeterPrice = (price: Stripe.Price): MeterPrice => {
  const isUnsupportedPrice =
    price.billing_scheme === "tiered" || price.unit_amount_decimal === null;

  if (isUnsupportedPrice) {
    throw new Error(`Stripe price ${price.id} must be a per-unit or package price, not tiered`);
  }

  return {
    amount: Number(price.unit_amount_decimal),
    size: price.transform_quantity?.divide_by ?? 1,
    round: price.transform_quantity?.round === "down" ? "down" : "up"
  };
};
const loadMeterPrices = async (): Promise<MeterPrices | null> => {
  const apiCallPriceID = config.STRIPE_PRO_API_CALL_PRICE_ID;
  const aiCreditPriceID = config.STRIPE_PRO_AI_CREDIT_PRICE_ID;
  const hasPrices = apiCallPriceID && aiCreditPriceID;

  if (!stripe || !hasPrices) return null;

  const [apiCalls, aiCredits] = await Promise.all([
    stripe.prices.retrieve(apiCallPriceID),
    stripe.prices.retrieve(aiCreditPriceID)
  ]);

  return {
    apiCalls: toMeterPrice(apiCalls),
    aiCredits: toMeterPrice(aiCredits),
    currency: apiCalls.currency
  };
};
const getMeterPrices = (): Promise<MeterPrices | null> => {
  if (!cachedPrices || cachedPrices.expiresAt <= Date.now()) {
    const prices = loadMeterPrices();

    cachedPrices = { prices, expiresAt: Date.now() + PRICE_CACHE_TTL };
    // Keeps a failure briefly, so bad prices don't call Stripe on every request.
    prices.catch(() => {
      cachedPrices = { prices, expiresAt: Date.now() + PRICE_FAILURE_TTL };
    });
  }

  return cachedPrices.prices;
};
/** Rounds the packages as Stripe does, so 1 call over the pool costs a whole package. */
const estimateCharge = (meter: MeterOverage, price: MeterPrice): number => {
  const packages = Math.max(meter.total - meter.limit, 0) / price.size;
  const billedPackages = price.round === "down" ? Math.floor(packages) : Math.ceil(packages);

  return Math.ceil(billedPackages * price.amount);
};
const estimateCharges = (usage: MeterOverages, prices: MeterPrices): MeterCharges => ({
  apiCalls: estimateCharge(usage.apiCalls, prices.apiCalls),
  aiCredits: estimateCharge(usage.aiCredits, prices.aiCredits)
});
const estimateSpend = (usage: MeterOverages, prices: MeterPrices): number => {
  const charges = estimateCharges(usage, prices);

  return charges.apiCalls + charges.aiCredits;
};

const getSpendingLimit = async (workspaceUUID: string): Promise<number | null> => {
  const [workspace] = await db
    .select({ spendingLimit: workspaces.spendingLimit })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceUUID));

  return workspace?.spendingLimit ?? null;
};

export { estimateCharges, estimateSpend, getMeterPrices, getSpendingLimit };
export type { MeterCharges, MeterPrices };
