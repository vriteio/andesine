import { Skeleton, Tooltip } from "@andesine/components";
import { type Component, type JSX, Show, Suspense } from "solid-js";
import { formatNumber } from "#web/lib/primitives";
import { Setting } from "../../setting";
import { UsageChart } from "./usage-chart";

interface MeterUsageProps {
  label: string;
  description: JSX.Element;
  unit: string;
  limitMessage: string;
  isPro: boolean;
  /** Largest cost of one request, as Free limits refuse requests that would pass them. */
  maxCost: number;
  meter?: { daily: Array<{ day: number; count: number }>; total: number; limit: number };
  period?: { startDate: Date; endDate: Date; resetDate: Date };
}

const MeterUsage: Component<MeterUsageProps> = (props) => {
  const limitExceeded = () => {
    return !props.isPro && (props.meter?.total ?? 0) + props.maxCost > (props.meter?.limit ?? 0);
  };

  return (
    <>
      <Setting label={props.label} description={props.description} fade={false}>
        <Show when={props.meter}>
          {(meter) => (
            <div class="flex items-end gap-0.5">
              <Tooltip
                content={
                  <div class="max-w-48 leading-tight whitespace-pre-wrap">
                    {limitExceeded() ? props.limitMessage : formatNumber(meter().total)}
                  </div>
                }
              >
                <div class="flex gap-1">
                  <Show when={limitExceeded()}>
                    <div class="i-lucide:triangle-alert h-4 w-4 text-amber-500" />
                  </Show>
                  <span class="text-base font-medium leading-none cursor-pointer">
                    {formatNumber(meter().total, { compact: true })}
                  </span>
                </div>
              </Tooltip>
              <span class="text-xs text-gray-400 leading-none">
                <span class="opacity-50">/</span> {formatNumber(meter().limit, { compact: true })}{" "}
                {props.isPro ? "included" : "limit"}
              </span>
            </div>
          )}
        </Show>
      </Setting>
      <Suspense fallback={<Skeleton class="h-46 w-full rounded-xl" />}>
        <Show when={props.meter && props.period && { meter: props.meter, period: props.period }}>
          {(data) => (
            <div class="pb-2">
              <UsageChart
                daily={data().meter.daily}
                currentDay={data().period.endDate.getUTCDate()}
                limit={data().meter.limit}
                daysInMonth={new Date(data().period.resetDate.getTime() - 1).getUTCDate()}
                year={data().period.startDate.getUTCFullYear()}
                month={data().period.startDate.getUTCMonth() + 1}
                unit={props.unit}
              />
            </div>
          )}
        </Show>
      </Suspense>
    </>
  );
};

export { MeterUsage };
