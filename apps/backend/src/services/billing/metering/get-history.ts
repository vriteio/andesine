// SPDX-License-Identifier: Elastic-2.0
import { billingPeriods, workspaces } from "@andesine/server/database";
import { getPeriodSeats, getPeriodStart } from "#backend/lib/billing";
import { toUUID } from "@andesine/contracts/primitives";
import { db, stripe } from "#backend/lib/adapters";
import { and, eq, gte } from "drizzle-orm";

interface Invoice {
  amount: number;
  url: string;
}

interface Invoiced {
  /** In cents, by month (YYYY-MM). */
  amounts: Map<string, number>;
  /** Hosted invoice pages, by month (YYYY-MM). */
  invoices: Map<string, Invoice[]>;
  currency: string | null;
}

interface MonthHistory {
  month: string;
  apiCalls: number;
  aiCredits: number;
  seats: number | null;
  charged: number | null;
  invoices: Invoice[];
}

interface BillingHistory {
  months: MonthHistory[];
  currency: string | null;
}

const toMonth = (date: Date): string => date.toISOString().slice(0, 7);
/** Amounts by the month an invoice bills, e.g. October's overage; null without Stripe data. */
const getInvoiced = async (customerID: string | null, since: Date): Promise<Invoiced | null> => {
  if (!stripe || !customerID) return null;

  const amounts = new Map<string, number>();
  const invoices = new Map<string, Invoice[]>();

  let currency: string | null = null;

  try {
    for await (const invoice of stripe.invoices.list({
      customer: customerID,
      created: { gte: Math.floor(since.getTime() / 1000) }
    })) {
      const isIssued = invoice.status === "paid" || invoice.status === "open";

      if (!isIssued) continue;

      const month = toMonth(new Date(invoice.period_start * 1000));

      amounts.set(month, (amounts.get(month) ?? 0) + invoice.amount_due);

      if (invoice.hosted_invoice_url) {
        invoices.set(month, [
          ...(invoices.get(month) ?? []),
          { amount: invoice.amount_due, url: invoice.hosted_invoice_url }
        ]);
      }
      currency ??= invoice.currency;
    }
  } catch (error) {
    console.error("Failed to load invoices for the billing history", { error });

    return null;
  }

  return { amounts, invoices, currency };
};

const getHistory = async (input: { workspaceID: string }): Promise<BillingHistory> => {
  const now = new Date();
  const workspaceUUID = toUUID(input.workspaceID);
  const [workspace] = await db
    .select({ customerID: workspaces.customerID, createdAt: workspaces.createdAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceUUID));
  // From the workspace's creation, but not before the start of the previous year.
  const created = workspace?.createdAt ?? now;
  const start = new Date(
    Math.max(
      Date.UTC(now.getUTCFullYear() - 1, 0),
      Date.UTC(created.getUTCFullYear(), created.getUTCMonth())
    )
  );
  const monthCount =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    start.getUTCMonth() +
    1;
  const months = Array.from({ length: monthCount }, (_, index) => {
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index));
  });
  const [periods, currentSeats, invoiced] = await Promise.all([
    db
      .select()
      .from(billingPeriods)
      .where(
        and(
          eq(billingPeriods.workspaceID, workspaceUUID),
          gte(billingPeriods.periodStart, getPeriodStart(months[0]))
        )
      ),
    getPeriodSeats(workspaceUUID, now),
    getInvoiced(workspace?.customerID ?? null, months[0])
  ]);
  const periodsByMonth = new Map(periods.map((period) => [period.periodStart.slice(0, 7), period]));

  return {
    months: months.map((date) => {
      const month = toMonth(date);
      const period = periodsByMonth.get(month);
      const seats = month === toMonth(now) ? currentSeats : period?.seats;

      return {
        month,
        apiCalls: period?.apiCalls ?? 0,
        aiCredits: period?.aiCredits ?? 0,
        seats: seats || null,
        charged: invoiced ? (invoiced.amounts.get(month) ?? 0) : null,
        invoices: invoiced?.invoices.get(month) ?? []
      };
    }),
    currency: invoiced?.currency ?? null
  };
};

export { getHistory };
