import { FeatureCard, type FeatureCardProps } from "../shared/feature-card";
import { FeatureDescription, type FeatureContentProps } from "../shared/feature-description";
import { AnswerSourcesGraphic, ChannelAnswerGraphic } from "../shared/feature-graphics/ai";
import { SiteSearchGraphic } from "../shared/feature-graphics/site";
import { Section } from "../shared/section";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface AgentPoint extends FeatureContentProps {
  icon: string;
}

const answerCards: FeatureCardProps[] = [
  {
    title: "Answers with sources.",
    text: "Every answer links to the pages it came from.",
    graphic: AnswerSourcesGraphic
  },
  {
    title: "Search as you type.",
    text: "Find any page in a few keystrokes.",
    graphic: SiteSearchGraphic
  },
  {
    title: "Current or published.",
    text: "Ask about drafts, or only what's live.",
    graphic: ChannelAnswerGraphic
  }
];
const apps = [
  ["i-simple-icons:claude", "Claude"],
  ["i-simple-icons:openai", "ChatGPT"],
  ["i-simple-icons:cursor", "Cursor"],
  ["i-simple-icons:visualstudiocode", "VS Code"],
  ["i-simple-icons:claude", "Claude Code"]
];
const agentPoints: AgentPoint[] = [
  {
    title: "Read and write.",
    text: "Agents search, read, and update entries for you.",
    icon: "i-lucide:file-pen-line"
  },
  {
    title: "Same rules as people.",
    text: "An agent sees only what its person can see.",
    icon: "i-lucide:shield-check"
  },
  {
    title: "For coding agents too.",
    text: "Run the server locally, or install the Claude Code and Cursor plugin.",
    icon: "i-lucide:terminal"
  }
];

const AgentAnswers: Component = () => (
  <Section
    id="ai-answers-title"
    title="Ask, and get answers."
    subtitle="Search that understands your questions."
  >
    <div class="grid gap-4 md:grid-cols-3">
      <For each={answerCards}>
        {(card, index) => <FeatureCard {...card} entryDelay={index() * 125} />}
      </For>
    </div>
  </Section>
);
const AgentApps: Component = () => (
  <Section
    id="ai-apps-title"
    title="Bring your own agent."
    subtitle="Connect any AI app through MCP."
  >
    <ul
      class="flex flex-wrap items-center gap-x-8 gap-y-4 text-gray-500"
      aria-label="Works with"
      data-entry="up"
    >
      <For each={apps}>
        {([icon, name]) => (
          <li class="flex items-center gap-2 text-lg font-medium">
            <span aria-hidden="true" class={clsx(icon, "h-6 w-6 text-gray-400")} />
            {name}
          </li>
        )}
      </For>
    </ul>
    <div class="grid gap-6 md:grid-cols-3">
      <For each={agentPoints}>
        {(point, index) => (
          <div data-entry="up" data-entry-delay={index() * 125}>
            <FeatureDescription
              title={point.title}
              text={point.text}
              marker={<span class={clsx(point.icon, "h-5 w-5 shrink-0 text-tertiary")} />}
            />
          </div>
        )}
      </For>
    </div>
  </Section>
);

export { AgentAnswers, AgentApps };
