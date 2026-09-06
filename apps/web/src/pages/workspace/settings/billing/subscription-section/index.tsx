import { Skeleton } from "@andesine/components";
import clsx from "clsx";
import { createAsync } from "@solidjs/router";
import { type Component, createEffect, createSignal, For, Suspense } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { config } from "#web/lib/api";
import { subscriptionQuery, usageQuery } from "#web/lib/data";
import { formatNumber, formatUSD } from "#web/lib/primitives";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { SubscriptionAction } from "./subscription-action";

const SubscriptionSection: Component = () => {
  const { currentWorkspace } = useWorkspace();
  const subscription = createAsync(() => subscriptionQuery());
  const usage = createAsync(() => usageQuery());
  const [subscriptionDetails, setSubscriptionDetails] =
    createSignal<Awaited<ReturnType<typeof subscriptionQuery>>>();
  const [usageDetails, setUsageDetails] = createSignal<Awaited<ReturnType<typeof usageQuery>>>();
  const isPro = () => {
    return (subscriptionDetails()?.plan ?? currentWorkspace()?.subscriptionPlan) === "pro";
  };
  const descriptionItems = () => {
    const details = subscriptionDetails();
    const currentUsage = usageDetails();

    if (isPro()) {
      return [
        <>
          <span class="font-medium text-gray-700">
            {details ? formatUSD(details.seats * config.PRICE_PER_SEAT_USD) : "—"}
            <span class="opacity-50 mx-0.5">/</span>
            mo.
          </span>{" "}
          base price
        </>,
        <>
          <span class="font-medium text-gray-700">
            {details?.seats ?? "—"} member {details?.seats === 1 ? "seat" : "seats"}
          </span>{" "}
          active
        </>,
        <>
          <span class="font-medium text-gray-700">
            {currentUsage ? formatNumber(currentUsage.totalUsage) : "—"} API calls
          </span>{" "}
          this month
        </>
      ];
    }

    return [
      "Unlimited team members",
      "Priority support",
      <>
        <span class="font-medium text-gray-700">500K API calls</span> included
      </>,
      <>
        <span class="font-medium text-gray-700">$1 per 50K</span> additional API calls
      </>
    ];
  };

  // Keep asynchronous reads out of the immediately rendered description.
  createEffect(() => setSubscriptionDetails(subscription()));
  createEffect(() => setUsageDetails(usage()));

  return (
    <SettingsSection label="Subscription">
      <Setting
        label={
          <div class="flex items-center gap-1 font-semibold">
            <div class="inline-flex items-center">
              <div class="h-4.5 w-4.5 i-andesine:logo bg-gradient-to-tr" />
              ndesine
            </div>
            <div class="w-px h-4 rounded-full bg-gray-300" />
            <div class="bg-gradient-to-tr text-transparent bg-clip-text">Pro</div>
          </div>
        }
        description={
          <div class="flex flex-col gap-1 mt-2">
            <For each={descriptionItems()}>
              {(item) => (
                <div class="flex gap-1.5">
                  <span
                    class={clsx(
                      "bg-gradient-to-tr h-4 w-4 flex-shrink-0",
                      isPro() ? "i-lucide:circle-dot-dashed" : "i-lucide:check"
                    )}
                  />
                  <span>{item}</span>
                </div>
              )}
            </For>
          </div>
        }
        fade={false}
      >
        <Suspense
          fallback={
            <div class="flex w-full flex-col gap-2 md:max-w-64">
              <Skeleton class="h-14 w-full rounded-xl" />
              <div class="min-h-12" />
            </div>
          }
        >
          <SubscriptionAction />
        </Suspense>
      </Setting>
    </SettingsSection>
  );
};

export { SubscriptionSection };
