import { Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { type Component } from "solid-js";
import { subscriptionQuery, usageQuery } from "#web/lib/data";
import { SettingsSection } from "../../settings-section";
import { MeterUsage } from "./meter-usage";

interface CreditUseProps {
  label: string;
  cost: string;
}

const CreditUse: Component<CreditUseProps> = (props) => (
  <Tooltip content={props.cost} wrapperClass="inline-flex">
    <span class="text-gray-700 underline decoration-gray-300 cursor-help @hover:decoration-gray-400">
      {props.label}
    </span>
  </Tooltip>
);
const UsageSection: Component = () => {
  const usage = createAsync(() => usageQuery());
  const subscription = createAsync(() => subscriptionQuery());
  const isPro = () => subscription()?.plan === "pro";

  return (
    <SettingsSection label="Usage">
      <MeterUsage
        label="Monthly API calls"
        description="Requests made with API, MCP or CLI"
        unit="calls"
        maxCost={1}
        limitMessage="Free plan limit reached. Upgrade to Pro to use the API."
        isPro={isPro()}
        meter={usage()?.apiCalls}
        period={usage()}
      />
      <MeterUsage
        label="Monthly AI credits"
        description={
          <>
            Used by <CreditUse label="AI answers" cost="3 credits each" /> and{" "}
            <CreditUse label="semantic search" cost="1 credit each" />
          </>
        }
        unit="credits"
        maxCost={3}
        limitMessage="Not enough Free plan credits left for AI answers. Upgrade to Pro for more credits."
        isPro={isPro()}
        meter={usage()?.aiCredits}
        period={usage()}
      />
    </SettingsSection>
  );
};

export { UsageSection };
