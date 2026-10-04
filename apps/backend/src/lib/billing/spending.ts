// SPDX-License-Identifier: Elastic-2.0
import { workspaces } from "@andesine/server/database";
import { db } from "#backend/lib/adapters/postgres";
import { stripe } from "#backend/lib/adapters/stripe";
import { config } from "#backend/lib/config";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

interface MeterPrices {
  /** Unit prices over the included amounts, in cents. */
  apiCalls: number;
  aiCredits: number;
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

let cachedPrices: CachedPrices | null = null;

/** The last tier applies over the included amount. */
const getUnitPrice = (price: Stripe.Price): number => {
  const lastTier = price.tiers?.[price.tiers.length - 1];
  const amount = lastTier?.unit_amount_decimal ?? price.unit_amount_decimal ?? "0";

  return Number(amount) / (price.transform_quantity?.divide_by ?? 1);
};
const loadMeterPrices = async (): Promise<MeterPrices | null> => {
  const apiCallPriceID = config.STRIPE_PRO_API_CALL_PRICE_ID;
  const aiCreditPriceID = config.STRIPE_PRO_AI_CREDIT_PRICE_ID;
  const hasPrices = apiCallPriceID && aiCreditPriceID;

  if (!stripe || !hasPrices) return null;

  const [apiCalls, aiCredits] = await Promise.all([
    stripe.prices.retrieve(apiCallPriceID, { expand: ["tiers"] }),
    stripe.prices.retrieve(aiCreditPriceID, { expand: ["tiers"] })
  ]);

  return {
    apiCalls: getUnitPrice(apiCalls),
    aiCredits: getUnitPrice(aiCredits),
    currency: apiCalls.currency
  };
};
const getMeterPrices = (): Promise<MeterPrices | null> => {
  if (!cachedPrices || cachedPrices.expiresAt <= Date.now()) {
    const prices = loadMeterPrices();

    cachedPrices = { prices, expiresAt: Date.now() + PRICE_CACHE_TTL };
    prices.catch(() => {
      cachedPrices = null;
    });
  }

  return cachedPrices.prices;
};
const estimateCharges = (usage: MeterOverages, prices: MeterPrices): MeterCharges => {
  const overage = (meter: MeterOverage) => Math.max(meter.total - meter.limit, 0);

  return {
    apiCalls: Math.ceil(overage(usage.apiCalls) * prices.apiCalls),
    aiCredits: Math.ceil(overage(usage.aiCredits) * prices.aiCredits)
  };
};
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
