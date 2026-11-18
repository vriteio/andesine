import { FeatureDescription, type FeatureContentProps } from "../shared/feature-description";
import { Section } from "../shared/section";
import { links } from "../../links";
import { IconButton } from "@andesine/components/primitives";
import { type Component, For, Show } from "solid-js";
import clsx from "clsx";

interface OpenSourcePoint extends FeatureContentProps {
  icon: string;
  link: string;
}
interface OpenSourceProps {
  stars?: number;
}

const points: OpenSourcePoint[] = [
  {
    title: "Open at the core.",
    text: "Because truly great experience requires no lock-in.",
    icon: "i-lucide:code-xml",
    link: links.repository
  },
  {
    title: "Run it anywhere.",
    text: "Use our cloud or host it yourself. Your servers, your data, your call.",
    icon: "i-lucide:server",
    link: links.selfHosting
  },
  {
    title: "Shape it to fit.",
    text: "An open extension ecosystem that makes Andesine fit the way your team works.",
    icon: "i-tabler:puzzle",
    link: links.product.extensions
  }
];
const starFormat = new Intl.NumberFormat("en", { notation: "compact" });

const OpenSource: Component<OpenSourceProps> = (props) => (
  <Section
    sectionId="open-source"
    id="open-source-title"
    title="Open by default."
    subtitle="Built in the open. Yours to run and shape."
  >
    <div class="grid gap-6 md:grid-cols-3">
      <For each={points}>
        {(point, index) => (
          <a href={point.link} class="group block" data-entry="up" data-entry-delay={index() * 125}>
            <FeatureDescription
              title={point.title}
              text={point.text}
              marker={
                <>
                  <span class={clsx(point.icon, "h-5 w-5 shrink-0 text-tertiary")} />
                  <span class="order-last i-lucide:arrow-up-right h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-tertiary" />
                </>
              }
            />
          </a>
        )}
      </For>
    </div>
    <div class="self-start" data-entry="up" data-entry-delay="375">
      <IconButton
        link={links.repository}
        variant="secondary"
        text="base"
        size="medium"
        class="gap-1.5 pl-2 pr-2"
        icon="i-mdi:github"
        iconProps={{ class: "h-5 w-5" }}
        label={() => (
          <>
            Star on GitHub
            <Show when={props.stars}>
              {(stars) => (
                <span class="flex items-center gap-1 border-l border-gray-200 pl-2 text-gray-500">
                  <span class="i-lucide:star h-4 w-4" />
                  {starFormat.format(stars())}
                </span>
              )}
            </Show>
          </>
        )}
      />
    </div>
  </Section>
);

export { OpenSource };
