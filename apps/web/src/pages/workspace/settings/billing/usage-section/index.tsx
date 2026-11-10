import { IconButton, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { format } from "date-fns";
import clsx from "clsx";
import { type Component, Suspense } from "solid-js";
import { historyQuery, subscriptionQuery, usageQuery } from "#web/lib/data";
import { SettingsSection } from "../../settings-section";
import { MeterUsage } from "./meter-usage";

interface CreditUseProps {
  label: string;
  cost: string;
}
interface UsageSectionProps {
  /** A past month as YYYY-MM; the current month without one. */
  month?: string;
  /** The month whose usage shows, until the selected one loads. */
  usageMonth?: string;
  loading: boolean;
  onMonthChange(month: string | undefined): void;
}

const shiftMonth = (month: string, by: number): string => {
  const date = new Date(`${month}-01T00:00:00Z`);

  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
};
const CreditUse: Component<CreditUseProps> = (props) => (
  <Tooltip content={props.cost} wrapperClass="inline-flex">
    <span class="text-gray-700 underline decoration-gray-300 cursor-help @hover:decoration-gray-400">
      {props.label}
    </span>
  </Tooltip>
);
const UsageSection: Component<UsageSectionProps> = (props) => {
  const usage = createAsync(() => usageQuery(props.usageMonth));
  const subscription = createAsync(() => subscriptionQuery());
  const history = createAsync(() => historyQuery());
  const isPro = () => subscription()?.plan === "pro";
  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const shownMonth = () => props.month || currentMonth();
  const firstMonth = () => history()?.months[0]?.month ?? currentMonth();
  const showMonth = (by: number) => {
    const month = shiftMonth(shownMonth(), by);

    props.onMonthChange(month === currentMonth() ? undefined : month);
  };

  return (
    <SettingsSection
      label="Usage"
      actions={
        <div class="-my-1.5 flex items-center gap-1">
          {/* The history loads from Stripe, so it doesn't hold the page. */}
          <Suspense
            fallback={
              <IconButton
                icon="i-lucide:chevron-left"
                variant="ghost"
                size="xs"
                aria-label="Previous month"
                disabled
              />
            }
          >
            <IconButton
              icon="i-lucide:chevron-left"
              variant="ghost"
              size="xs"
              aria-label="Previous month"
              disabled={shownMonth() <= firstMonth()}
              onClick={() => showMonth(-1)}
            />
          </Suspense>
          <span class="w-16 text-center text-gray-500">
            {format(new Date(`${shownMonth()}-01T00:00:00`), "MMM yyyy")}
          </span>
          <IconButton
            icon="i-lucide:chevron-right"
            variant="ghost"
            size="xs"
            aria-label="Next month"
            disabled={!props.month}
            onClick={() => showMonth(1)}
          />
        </div>
      }
    >
      <div class={clsx("flex flex-col transition-opacity", props.loading && "opacity-50")}>
        <MeterUsage
          label="Monthly API calls"
          description="Requests made with API, MCP or CLI"
          unit="calls"
          maxCost={1}
          limitMessage="Free plan limit reached. Upgrade to Pro to use the API."
          isPro={isPro()}
          current={!props.usageMonth}
          meter={usage()?.apiCalls}
          period={usage()}
        />
        <MeterUsage
          label="Monthly AI credits"
          description={
            <>
              Used by <CreditUse label="AI answers" cost="10 credits each" /> and{" "}
              <CreditUse label="semantic search" cost="1 credit each" />
            </>
          }
          unit="credits"
          maxCost={10}
          limitMessage="Not enough Free plan credits left for AI answers. Upgrade to Pro for more credits."
          isPro={isPro()}
          current={!props.usageMonth}
          meter={usage()?.aiCredits}
          period={usage()}
        />
      </div>
    </SettingsSection>
  );
};

export { UsageSection };
