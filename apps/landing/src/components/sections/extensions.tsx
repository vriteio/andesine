import { CardStrip, type StripCard } from "../shared/card-strip";
import { FeatureCard } from "../shared/feature-card";
import { GitHubSyncGraphic, HostedSiteGraphic } from "../shared/feature-graphics";
import {
  ElementViewGraphic,
  ExtensionActionsGraphic,
  ExtensionCodeGraphic,
  ExtensionPanelGraphic
} from "../shared/feature-graphics/extensions";
import { Section, SectionHeadline } from "../shared/section";
import { links } from "../../links";
import { type Component, For } from "solid-js";
import clsx from "clsx";

const installable: StripCard[] = [
  {
    title: "Andesine Pages.",
    text: "Publish any collection as a docs site.",
    graphic: HostedSiteGraphic,
    icon: "i-lucide:globe",
    link: links.product.pages
  },
  {
    title: "GitHub Sync.",
    text: "Keep your content in sync with Markdown in your repo.",
    graphic: GitHubSyncGraphic,
    icon: "i-mdi:github",
    link: links.githubSyncDocs
  }
];
const surfaces: StripCard[] = [
  {
    title: "Panels.",
    text: "Add a side panel next to every entry, with your own tools and settings.",
    graphic: ExtensionPanelGraphic
  },
  {
    title: "Element views.",
    text: "Show your own blocks right in the editor, just as your site renders them.",
    graphic: ElementViewGraphic
  },
  {
    title: "Actions and menus.",
    text: "Add commands to blocks, menus, and the toolbar.",
    graphic: ExtensionActionsGraphic
  },
  {
    title: "A backend.",
    text: "Run server code and store data for your extension.",
    graphic: ExtensionCodeGraphic
  }
];

const ExtensionCatalog: Component = () => (
  <Section
    id="extensions-catalog-title"
    title="Ready to install."
    subtitle="Start with the essentials."
  >
    <div class="grid gap-4 md:grid-cols-2">
      <For each={installable}>
        {(extension, index) => (
          <a href={extension.link} class="group block h-full">
            <FeatureCard
              title={extension.title}
              text={extension.text}
              graphic={extension.graphic}
              entryDelay={index() * 125}
              marker={
                <>
                  <span class={clsx(extension.icon, "h-4 w-4 shrink-0 text-tertiary")} />
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
const ExtensionSurfaces: Component = () => (
  <section
    aria-labelledby="extensions-build-title"
    class="relative flex flex-col gap-6 isolate md:gap-8"
  >
    <div class="mx-auto w-full max-w-5xl px-4 md:px-8">
      <SectionHeadline
        id="extensions-build-title"
        title="Build your own."
        subtitle="Everything an extension can add."
      />
    </div>
    <CardStrip id="extensions-strip" label="What extensions can add" cards={surfaces} />
  </section>
);

export { ExtensionCatalog, ExtensionSurfaces };
