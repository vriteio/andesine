import { Section } from "../shared/section";
import { links } from "../../links";
import { AnimatedGradientCard } from "@andesine/components/fragments";
import { Button, Card } from "@andesine/components/primitives";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface PlanFeaturesProps {
  label: string;
  features: string[];
  inverted?: boolean;
}

interface ComparisonGroup {
  label: string;
  rows: Array<[feature: string, free: string, pro: string]>;
}

// Prices and Pro allowances match the web app's billing/subscription-section UI
// and apps/web/src/lib/api/config.ts. There is no advertised annual plan or trial.
const freeFeatures = [
  "Up to 3 members, all admins",
  "50K API calls and 5K AI credits a month",
  "GitHub Sync, MCP, and the API",
  "A hosted docs site"
];
const proFeatures = [
  "Unlimited members, roles, and groups",
  "150K API calls and 15K AI credits per seat",
  "Custom domains and private repositories",
  "30-day history and 50 GiB of storage"
];
const comparison: ComparisonGroup[] = [
  {
    label: "Team",
    rows: [
      ["Members", "Up to 3", "Unlimited"],
      ["Roles", "All members are admins", "Default and custom roles"],
      ["Groups and restricted collections", "—", "Included"]
    ]
  },
  {
    label: "Usage",
    rows: [
      ["API calls each month", "50,000", "150,000 per seat, shared"],
      ["AI credits each month", "5,000", "15,000 per seat, shared"],
      ["Extra usage", "Stops at the limit", "$1 per 50K API calls or 5K AI credits"],
      ["Spending limit", "—", "Included"]
    ]
  },
  {
    label: "Content",
    rows: [
      ["Collections, schemas, and publishing", "Included", "Included"],
      ["Version history", "7 days", "30 days"],
      ["Image storage", "1 GiB", "50 GiB"]
    ]
  },
  {
    label: "Publishing",
    rows: [
      ["Hosted docs sites", "With a badge", "Custom domains, no badge"],
      ["GitHub Sync", "Public repositories", "Public and private repositories"],
      ["API, SDK, CLI, and MCP", "Included", "Included"]
    ]
  }
];

const PlanFeatures: Component<PlanFeaturesProps> = (props) => (
  <>
    <span class={clsx("mt-5", props.inverted ? "text-white/60" : "text-gray-400")}>
      {props.label}
    </span>
    <ul class="mt-2 flex flex-col gap-1 text-base">
      <For each={props.features}>
        {(feature) => (
          <li class="flex items-start gap-2">
            <span
              aria-hidden="true"
              class={clsx(
                "i-lucide:check mt-1 h-4 w-4 shrink-0",
                props.inverted ? "text-white/60" : "text-gray-400"
              )}
            />
            {feature}
          </li>
        )}
      </For>
    </ul>
  </>
);
const PlanComparison: Component = () => (
  <details class="group">
    <summary class="flex w-max cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1 font-medium text-gray-500 @hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
      Compare plans
      <span
        aria-hidden="true"
        class="i-lucide:chevron-down h-4 w-4 transition-transform group-open:rotate-180"
      />
    </summary>
    <Card shade class="mt-2 overflow-x-auto bg-white! p-0">
      <table class="w-full min-w-120 text-left text-base">
        <thead>
          <tr class="text-gray-400">
            <th class="w-2/5 px-4 py-3 font-medium">Feature</th>
            <th class="px-4 py-3 font-medium">Free</th>
            <th class="px-4 py-3 font-medium">Pro</th>
          </tr>
        </thead>
        <For each={comparison}>
          {(group) => (
            <tbody>
              <tr>
                <th colSpan={3} class="border-t border-gray-100 bg-gray-50 px-4 py-2 font-semibold text-gray-700">
                  {group.label}
                </th>
              </tr>
              <For each={group.rows}>
                {([feature, free, pro]) => (
                  <tr class="border-t border-gray-100">
                    <th class="px-4 py-2 font-normal text-gray-700">{feature}</th>
                    <td class="px-4 py-2 text-gray-500">{free}</td>
                    <td class="px-4 py-2 text-gray-700">{pro}</td>
                  </tr>
                )}
              </For>
            </tbody>
          )}
        </For>
      </table>
    </Card>
  </details>
);

const Pricing: Component = () => {
  return (
    <Section
      sectionId="pricing"
      id="pricing-title"
      title="Simple pricing."
      subtitle="Start writing. Grow together."
    >
      <div class="grid gap-4 md:grid-cols-2">
        <Card shade class="flex flex-col bg-white! p-6 md:px-8" data-entry="up">
          <h3 class="flex items-center text-2xl font-semibold">Free</h3>
          <span class="mt-1 text-gray-500">For small teams getting started.</span>
          <div class="align-start mb-4 mt-3 flex items-center gap-3">
            <span class="text-5xl font-bold">
              <span class="text-[75%] opacity-50">$</span>0
            </span>
            <div class="flex flex-col">
              <span class="text-sm leading-tight text-gray-500">USD</span>
              <span class="text-sm leading-tight text-gray-500">/ month</span>
            </div>
          </div>
          <Button
            link={links.cloudSignUp}
            variant="secondary"
            size="medium"
            class="w-full self-start bg-gray-50 text-center"
          >
            Get started
          </Button>
          <PlanFeatures label="Includes:" features={freeFeatures} />
        </Card>
        <div
          class="relative isolate overflow-hidden rounded-2xl shadow-md shadow-tertiary/25"
          data-entry="up"
          data-entry-delay="125"
        >
          <AnimatedGradientCard
            aria-hidden="true"
            class="absolute! inset-0 h-full w-full rounded-2xl"
          />
          <div class="relative flex h-full flex-col p-6 text-white md:px-8">
            <h3 class="flex items-center text-2xl font-semibold">Pro</h3>
            <span class="mt-1 text-white/80">For growing teams and products.</span>
            <div class="align-start mb-4 mt-3 flex items-center gap-3">
              <span class="text-5xl font-bold">
                <span class="text-[75%] opacity-50">$</span>12
              </span>
              <div class="flex flex-col">
                <span class="text-sm leading-tight text-white/80">USD / seat / month</span>
                <span class="text-sm leading-tight text-white/80">Agents never need a seat</span>
              </div>
            </div>
            <a
              href={links.cloudSignUp}
              class="w-full self-start rounded-lg bg-white/20 px-2 py-1 text-center text-white @hover:bg-white/30"
            >
              Get Andesine Pro
            </a>
            <PlanFeatures label="Everything in Free, plus:" features={proFeatures} inverted />
          </div>
        </div>
        <Card
          shade
          class="flex flex-col gap-3 bg-white! p-6 md:col-span-2 md:flex-row md:items-center md:px-8"
          data-entry="up"
          data-entry-delay="250"
        >
          <div class="flex flex-1 flex-col">
            <h3 class="text-lg font-semibold">Self-hosted</h3>
            <span class="text-gray-500">
              Open source and free. All Pro features on your own servers.
            </span>
          </div>
          <Button
            link={links.repository}
            target="_blank"
            variant="secondary"
            size="medium"
            class="flex items-center justify-center gap-1.5 bg-gray-50"
          >
            <span aria-hidden="true" class="i-mdi:github h-4 w-4" />
            View on GitHub
          </Button>
        </Card>
      </div>
      <PlanComparison />
    </Section>
  );
};

export { Pricing };
