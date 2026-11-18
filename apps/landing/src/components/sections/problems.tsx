import { FeatureCard, type FeatureCardProps } from "../shared/feature-card";
import {
  DocsEditorGraphic,
  StructuredContentGraphic,
  AccessControlGraphic,
  HubGraphic
} from "../shared/feature-graphics";
import { Section } from "../shared/section";
import { links } from "../../links";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface Problem extends FeatureCardProps {
  icon: string;
  link: string;
}

const problems: Problem[] = [
  {
    title: "Product docs.",
    graphic: DocsEditorGraphic,
    text: "Editor for everyone. Publish a site, sync with Git, or deliver to your app in a click.",
    icon: "i-lucide:book-open",
    link: links.useCases.documentation
  },
  {
    title: "Structured content.",
    graphic: StructuredContentGraphic,
    text: "Content and data, side by side, built on your schema. Strictly enforced, flexible to work with.",
    icon: "i-lucide:database",
    link: links.useCases.headlessCms
  },
  {
    title: "Team knowledge base.",
    graphic: AccessControlGraphic,
    text: "You decide who sees what. At any level, to any degree. In groups or one by one.",
    icon: "i-lucide:library",
    link: links.useCases.knowledgeBase
  },
  {
    title: "Centralized hub.",
    graphic: HubGraphic,
    text: "Don't repeat yourself. With everything in a single place, your agents will already know.",
    icon: "i-material-symbols:magic-button-outline",
    link: links.useCases.centralHub
  }
];

const Problems: Component = () => (
  <Section
    sectionId="problems"
    id="problems-title"
    title="No more workarounds."
    subtitle="One place for all of it."
  >
    <div class="grid gap-4 md:grid-cols-2">
      <For each={problems}>
        {(problem, index) => (
          <a href={problem.link} class="group block h-full">
            <FeatureCard
              title={problem.title}
              text={problem.text}
              graphic={problem.graphic}
              entryDelay={(index() % 2) * 125}
              marker={
                <>
                  <span class={clsx(problem.icon, "h-4 w-4 shrink-0 text-tertiary")} />
                  <span class="order-last i-lucide:arrow-up-right h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-tertiary" />
                </>
              }
            />
          </a>
        )}
      </For>
    </div>
  </Section>
);

export { Problems };
