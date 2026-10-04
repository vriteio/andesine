import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { timestamps } from "./shared";

interface SubscriptionData {
  subscriptionID: string;
  seatItemID?: string;
  apiUsageItemID?: string;
  aiCreditItemID?: string;
  billingCycleAnchor: number;
  cancelAt: number | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt: number | null;
  cancellationDetails: {
    comment: string | null;
    feedback: string | null;
    reason: string | null;
  } | null;
  collectionMethod: string;
  createdAt: number;
  currentPeriodEnd: number | null;
  currentPeriodStart: number | null;
  endedAt: number | null;
  startedAt: number;
  trialEnd: number | null;
  trialStart: number | null;
}

const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull(),
    logoAssetID: uuid("logo_asset_id").references((): AnyPgColumn => assets.id, {
      onDelete: "restrict"
    }),
    customerID: text("customer_id"),
    subscriptionStatus: text("subscription_status").notNull().default("active"),
    subscriptionPlan: text("subscription_plan").notNull().default("free"),
    subscriptionData: jsonb("subscription_data").$type<SubscriptionData>(),
    subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
    /** In cents. */
    spendingLimit: integer("spending_limit"),
    deletingAt: timestamp("deleting_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    uniqueIndex("workspaces_customer_id_unique")
      .on(table.customerID)
      .where(sql`${table.customerID} is not null`)
  ]
);

export { workspaces };
export type { SubscriptionData };
