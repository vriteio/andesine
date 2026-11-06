import { Skeleton } from "@andesine/components";
import clsx from "clsx";
import { createAsync } from "@solidjs/router";
import { type Component, createEffect, createSignal, For, Suspense } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { config } from "#web/lib/api";
import { FREE_MEMBER_LIMIT, subscriptionQuery, usageQuery } from "#web/lib/data";
import { formatNumber, formatUSD } from "#web/lib/primitives";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { SubscriptionAction } from "./subscription-action";

// Widths of the Pro details while they load; 1em with 0.125em margins fills a leading-tight line.
const DETAIL_SKELETON_WIDTHS = ["w-40", "w-36", "w-60", "w-56"];

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
      const isLoading = !details || !currentUsage;

      if (isLoading) {
        return DETAIL_SKELETON_WIDTHS.map((width) => (
          <Skeleton class={clsx("h-[1em] my-[0.125em] rounded", width)} />
        ));
      }

      const blocksFree = details.seats > FREE_MEMBER_LIMIT;

      return [
        <>
          <span class="font-medium text-gray-700">
            {formatUSD(details.seats * config.PRICE_PER_SEAT_USD)}
            <span class="opacity-50 mx-0.5">/</span>
            mo.
          </span>{" "}
          base price
        </>,
        <>
          <span class="font-medium text-gray-700">
            {details.seats} member {details.seats === 1 ? "seat" : "seats"}
          </span>{" "}
          active
        </>,
        <>
          <span class="font-medium text-gray-700">
            {formatNumber(currentUsage.apiCalls.total)} of{" "}
            {formatNumber(currentUsage.apiCalls.limit)} API calls
          </span>{" "}
          this month
        </>,
        <>
          <span class="font-medium text-gray-700">
            {formatNumber(currentUsage.aiCredits.total)} of{" "}
            {formatNumber(currentUsage.aiCredits.limit)} AI credits
          </span>{" "}
          this month
        </>,
        ...(blocksFree
          ? [
              <>
                Moving to Free needs{" "}
                <span class="font-medium text-gray-700">{FREE_MEMBER_LIMIT} members</span> or fewer
              </>
            ]
          : [])
      ];
    }

    return [
      "Unlimited members, with roles, groups and restricted collections",
      "Custom domains for hosted sites, without the badge",
      <>
        <span class="font-medium text-gray-700">150K API calls</span> and{" "}
        <span class="font-medium text-gray-700">15K AI credits</span> per seat, shared across the
        workspace
      </>,
      <>
        <span class="font-medium text-gray-700">$1 per 50K</span> additional API calls
      </>,
      <>
        <span class="font-medium text-gray-700">$1 per 5K</span> additional AI credits
      </>,
      <>
        <span class="font-medium text-gray-700">30 days</span> of version history and{" "}
        <span class="font-medium text-gray-700">50 GiB</span> of storage
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
