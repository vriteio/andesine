import { Skeleton, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { type Component, Show, Suspense } from "solid-js";
import { subscriptionQuery, usageQuery } from "#web/lib/data";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { UsageChart } from "./usage-chart";
import { formatNumber } from "#web/lib/primitives";

const UsageSection: Component = () => {
  const usage = createAsync(() => usageQuery());
  const subscription = createAsync(() => subscriptionQuery());
  const isPro = () => subscription()?.plan === "pro";
  const limitExceeded = () => !isPro() && (usage()?.totalUsage || 0) >= (usage()?.limit || 0);

  return (
    <SettingsSection label="API Usage">
      <Setting
        label="Monthly API calls"
        description="Requests made this UTC month. The allowance resets at 00:00 UTC on the first day of each month."
        fade={false}
      >
        <Show when={usage()}>
          {(usageData) => (
            <div class="flex items-end gap-0.5">
              <Tooltip
                content={
                  <div class="max-w-48 leading-tight whitespace-pre-wrap">
                    {limitExceeded()
                      ? "You've reached the Free plan API limit. Upgrade to Andesine Pro to continue using the API."
                      : formatNumber(usageData().totalUsage)}
                  </div>
                }
              >
                <div class="flex gap-1">
                  <Show when={limitExceeded()}>
                    <div class="i-lucide:triangle-alert h-4 w-4 text-amber-500" />
                  </Show>
                  <span class="text-base font-medium leading-none cursor-pointer">
                    {formatNumber(usageData().totalUsage, { compact: true })}
                  </span>
                </div>
              </Tooltip>
              <span class="text-xs text-gray-400 leading-none">
                <span class="opacity-50">/</span>{" "}
                {formatNumber(usageData().limit, { compact: true })}{" "}
                {isPro() ? "included" : "limit"}
              </span>
            </div>
          )}
        </Show>
      </Setting>
      <Suspense fallback={<Skeleton class="h-44 w-full rounded-xl" />}>
        <Show when={usage()}>
          {(usageData) => (
            <UsageChart
              daily={usageData().dailyUsage}
              currentDay={usageData().endDate.getUTCDate()}
              limit={usageData().limit}
              daysInMonth={new Date(usageData().resetDate.getTime() - 1).getUTCDate()}
              year={usageData().startDate.getUTCFullYear()}
              month={usageData().startDate.getUTCMonth() + 1}
            />
          )}
        </Show>
      </Suspense>
    </SettingsSection>
  );
};

export { UsageSection };
