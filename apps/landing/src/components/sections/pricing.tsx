import { Section } from "../shared/section";
import { links } from "../../links";
import { AnimatedGradientCard } from "@andesine/components/fragments";
import { Button, Card } from "@andesine/components/primitives";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface PlanFeaturesProps {
  features: string[];
  inverted?: boolean;
}

// Prices and Pro allowances match the web app's billing/subscription-section UI
// and apps/web/src/lib/api/config.ts. There is no advertised annual plan or trial.
const freeFeatures = ["Rich text editing", "Collections and schemas", "Publishing and API access"];
const proFeatures = [
  "Unlimited team members",
  "Roles, groups, and collection access",
  "Priority support",
  "500K API calls per month"
];

const PlanFeatures: Component<PlanFeaturesProps> = (props) => (
  <>
    <span class={clsx("mt-4", props.inverted ? "text-white/50" : "text-gray-400")}>Includes:</span>
    <ul class="mt-2 flex flex-col gap-1 text-base">
      <For each={props.features}>
        {(feature) => (
          <li class="flex items-start gap-2">
            <span
              aria-hidden="true"
              class={clsx(
                "i-lucide:check mt-1 h-4 w-4 shrink-0",
                props.inverted ? "text-white/50" : "text-gray-400"
              )}
            />
            {feature}
          </li>
        )}
      </For>
    </ul>
  </>
);

const Pricing: Component = () => {
  return (
    <Section
      sectionId="pricing"
      id="pricing-title"
      title="Simple pricing."
      subtitle="Start writing. Grow together."
    >
      <div class="grid gap-4 md:grid-cols-2 md:max-w-3/4">
        <Card shade class="flex flex-col bg-white! p-6 md:px-8" data-entry="up">
          <h3 class="flex items-center text-2xl font-semibold">Free</h3>
          <div class="flex align-start items-center mt-3 mb-4 gap-3">
            <span class="text-5xl font-bold">
              <span class="opacity-50 text-[75%]">$</span>0
            </span>
            <div class="flex flex-col">
              <span class="text-sm text-gray-500 leading-tight">USD</span>
              <span class="text-sm text-gray-500 leading-tight">/ month</span>
            </div>
          </div>
          <Button
            link={links.cloudSignUp}
            color="contrast"
            variant="outlined"
            class="self-start text-center w-full bg-gray-50"
          >
            Get started
          </Button>
          <PlanFeatures features={freeFeatures} />
        </Card>
        <div
          class="relative isolate overflow-hidden rounded-2xl"
          data-entry="up"
          data-entry-delay="125"
        >
          <AnimatedGradientCard
            aria-hidden="true"
            class="absolute! inset-0 h-full w-full rounded-2xl"
          />
          <div class="relative flex h-full flex-col p-6 text-white md:px-8">
            <h3 class="flex items-center text-2xl font-semibold">Pro</h3>
            <div class="flex align-start items-center mt-3 mb-4 gap-3">
              <span class="text-5xl font-bold">
                <span class="opacity-50 text-[75%]">$</span>12
              </span>
              <div class="flex flex-col">
                <span class="text-sm text-white/80 leading-tight">USD / seat / month</span>
                <span class="text-sm text-white/80 leading-tight">$1 per 50K API calls</span>
              </div>
            </div>
            <a
              href={links.cloudSignUp}
              class="self-start text-center bg-white/20 hover text-white w-full px-2 py-1 rounded-lg @hover:bg-white/30"
            >
              Get Andesine Pro
            </a>
            <PlanFeatures features={proFeatures} inverted />
          </div>
        </div>
      </div>
    </Section>
  );
};

export { Pricing };
