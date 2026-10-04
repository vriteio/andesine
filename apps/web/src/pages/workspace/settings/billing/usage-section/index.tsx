import { createAsync } from "@solidjs/router";
import { type Component } from "solid-js";
import { subscriptionQuery, usageQuery } from "#web/lib/data";
import { SettingsSection } from "../../settings-section";
import { MeterUsage } from "./meter-usage";

const UsageSection: Component = () => {
  const usage = createAsync(() => usageQuery());
  const subscription = createAsync(() => subscriptionQuery());
  const isPro = () => subscription()?.plan === "pro";

  return (
    <SettingsSection label="Usage">
      <MeterUsage
        label="Monthly API calls"
        description="Requests with API keys or OAuth. Resets monthly."
        unit="calls"
        maxCost={1}
        limitMessage="Free plan limit reached. Upgrade to Pro to use the API."
        isPro={isPro()}
        meter={usage()?.apiCalls}
        period={usage()}
      />
      <MeterUsage
        label="Monthly AI credits"
        description="3 for each AI answer, 1 for each semantic search. Resets monthly."
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
