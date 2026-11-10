import { LineChart, Skeleton, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { format } from "date-fns";
import { type Component, For, Show, Suspense } from "solid-js";
import { historyQuery } from "#web/lib/data";
import { formatCents, formatNumber } from "#web/lib/primitives";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";

interface HistoryTableProps {
  history: History;
  onSelect(month: string | undefined): void;
}
interface HistorySectionProps {
  /** Shows a month's daily usage; the current month as undefined. */
  onSelect(month: string | undefined): void;
}

type History = Awaited<ReturnType<typeof historyQuery>>;

const HISTORY_MONTHS = 6;

const formatMonth = (month: string): string => format(new Date(`${month}-01T00:00:00`), "MMM yyyy");
const HistoryTable: Component<HistoryTableProps> = (props) => {
  const currentMonth = () => props.history.months.at(-1)?.month;
  const formatCharged = (charged: number | null) => {
    return charged === null || !props.history.currency
      ? "—"
      : formatCents(charged, props.history.currency);
  };

  return (
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-gray-400">
          <tr>
            <th class="py-1 pr-3 text-left font-normal">Month</th>
            <th class="px-3 py-1 text-right font-normal">Seats</th>
            <th class="px-3 py-1 text-right font-normal">API calls</th>
            <th class="px-3 py-1 text-right font-normal">AI credits</th>
            <th class="py-1 pl-3 text-right font-normal">Invoiced</th>
          </tr>
        </thead>
        <tbody>
          <For each={[...props.history.months].reverse()}>
            {(month) => (
              <tr class="border-t border-gray-200">
                <td class="py-1.5 pr-3 text-gray-700">
                  <button
                    type="button"
                    class="underline decoration-gray-300 @hover:decoration-gray-400"
                    aria-label={`Show the daily usage of ${formatMonth(month.month)}`}
                    onClick={() => {
                      props.onSelect(month.month === currentMonth() ? undefined : month.month);
                    }}
                  >
                    {formatMonth(month.month)}
                  </button>
                </td>
                <td class="px-3 py-1.5 text-right">{month.seats ?? "—"}</td>
                <td class="px-3 py-1.5 text-right">{formatNumber(month.apiCalls)}</td>
                <td class="px-3 py-1.5 text-right">{formatNumber(month.aiCredits)}</td>
                <td class="py-1.5 pl-3 text-right font-medium text-gray-700">
                  <Show
                    when={month.invoices.length === 1 && month.invoices[0]}
                    fallback={
                      <span class="inline-flex items-center gap-1">
                        {formatCharged(month.charged)}
                        <For each={month.invoices}>
                          {(invoice) => (
                            <Tooltip content={formatCharged(invoice.amount)} wrapperClass="flex">
                              <a
                                href={invoice.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="i-lucide:external-link h-3.5 w-3.5 text-gray-400 @hover:text-gray-600"
                                aria-label={`Open the invoice of ${formatCharged(invoice.amount)}`}
                              />
                            </Tooltip>
                          )}
                        </For>
                      </span>
                    }
                  >
                    {(invoice) => (
                      <a
                        href={invoice().url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="group/invoice inline-flex items-center gap-1"
                        aria-label={`Open the invoice of ${formatCharged(invoice().amount)}`}
                      >
                        <span class="underline decoration-gray-300 group-hover/invoice:decoration-gray-400">
                          {formatCharged(month.charged)}
                        </span>
                        <span class="i-lucide:external-link h-3.5 w-3.5 text-gray-400 group-hover/invoice:text-gray-600" />
                      </a>
                    )}
                  </Show>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
/** The last months' usage, seats and invoices; the chart shows invoices when billed. */
const HistorySection: Component<HistorySectionProps> = (props) => {
  const allHistory = createAsync(() => historyQuery());
  // The Usage section's month selector reaches the older months.
  const history = () => {
    const current = allHistory();

    return current && { ...current, months: current.months.slice(-HISTORY_MONTHS) };
  };
  const invoicedChart = () => {
    const current = history();
    const hasInvoices = current?.currency && current.months.some(({ charged }) => charged);

    return hasInvoices
      ? current.months.map((month) => ({ x: formatMonth(month.month), y: month.charged ?? 0 }))
      : null;
  };

  return (
    <SettingsSection label="History">
      <Setting
        label="Monthly history"
        description="Usage, seats and invoiced amounts of the last 6 months"
        fade={false}
      />
      <Suspense fallback={<Skeleton class="h-46 w-full rounded-xl" />}>
        <Show when={history()}>
          {(current) => (
            <div class="flex flex-col gap-3 pb-2">
              <Show when={invoicedChart()}>
                {(data) => (
                  <LineChart
                    data={data()}
                    formatY={(cents) => formatCents(cents, current().currency!)}
                    tooltipPlacement="point"
                    tooltipClass="py-1.5 px-2 bg-gray-800 text-gray-50 ring-1 ring-gray-900 shadow-inner shadow-gray-900 rounded-lg"
                    tooltipContent={(point) => (
                      <div class="flex flex-col gap-0.5">
                        <span class="opacity-50 leading-none">{point.x}</span>
                        <span class="text-sm font-medium leading-none">
                          {formatCents(point.y, current().currency!)}
                        </span>
                      </div>
                    )}
                  />
                )}
              </Show>
              <HistoryTable history={current()} onSelect={props.onSelect} />
            </div>
          )}
        </Show>
      </Suspense>
    </SettingsSection>
  );
};

export { HistorySection };
