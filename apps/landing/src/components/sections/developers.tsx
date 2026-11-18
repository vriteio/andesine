import { FeatureCard, type FeatureCardProps } from "../shared/feature-card";
import { FeatureDescription, type FeatureContentProps } from "../shared/feature-description";
import { TransformerGraphic } from "../shared/feature-graphics";
import { SchemaTypesGraphic } from "../shared/feature-graphics/content-model";
import {
  ApiKeysGraphic,
  CodeTabsGraphic,
  WebhookGraphic
} from "../shared/feature-graphics/developers";
import { Section } from "../shared/section";
import { type Component, For } from "solid-js";
import clsx from "clsx";

interface DeveloperTool extends FeatureContentProps {
  icon: string;
}

const tools: DeveloperTool[] = [
  {
    title: "HTTP API.",
    text: "JSON in, JSON out, with keys you control.",
    icon: "i-lucide:globe"
  },
  {
    title: "TypeScript SDK.",
    text: "A method for every operation, in Node, browsers, and workers.",
    icon: "i-lucide:braces"
  },
  {
    title: "CLI.",
    text: "Sign in, call the API, and generate types from your terminal.",
    icon: "i-lucide:terminal"
  }
];
const stackCards: FeatureCardProps[] = [
  {
    title: "Webhooks.",
    text: "Get a request when content changes or goes live.",
    graphic: WebhookGraphic
  },
  {
    title: "Typed content.",
    text: "Generate types from your schemas, and keep them fresh in CI.",
    graphic: SchemaTypesGraphic
  },
  {
    title: "Any format.",
    text: "Convert content to Markdown, MDX, HTML, and more.",
    graphic: TransformerGraphic
  },
  {
    title: "Keys for every place.",
    text: "Secret keys for servers, publishable keys for browsers.",
    graphic: ApiKeysGraphic
  }
];

const DeveloperTools: Component = () => (
  <Section
    id="developer-tools-title"
    title="Every way in."
    subtitle="Pick the tool that fits your stack."
  >
    <CodeTabsGraphic />
    <div class="grid gap-6 md:grid-cols-3">
      <For each={tools}>
        {(tool, index) => (
          <div data-entry="up" data-entry-delay={index() * 125}>
            <FeatureDescription
              title={tool.title}
              text={tool.text}
              marker={<span class={clsx(tool.icon, "h-5 w-5 shrink-0 text-tertiary")} />}
            />
          </div>
        )}
      </For>
    </div>
  </Section>
);
const DeveloperStack: Component = () => (
  <Section
    id="developer-stack-title"
    title="Fits into your stack."
    subtitle="Stay in sync, automatically."
  >
    <div class="grid gap-4 md:grid-cols-2">
      <For each={stackCards}>
        {(card, index) => <FeatureCard {...card} entryDelay={(index() % 2) * 125} />}
      </For>
    </div>
  </Section>
);

export { DeveloperTools, DeveloperStack };
