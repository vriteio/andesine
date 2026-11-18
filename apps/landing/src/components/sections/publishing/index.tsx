import {
  ContentAPIGraphic,
  PublishingGraphic,
  HistoryGraphic,
  TransformerGraphic,
  HostedSiteGraphic,
  GitHubSyncGraphic
} from "../../shared/feature-graphics";
import { CardStrip, type StripCard } from "../../shared/card-strip";
import { SectionHeadline } from "../../shared/section";
import { links } from "../../../links";
import { type Component } from "solid-js";

const stages: StripCard[] = [
  {
    title: "Hosted docs sites.",
    text: "Turn any collection into a docs site, with search and AI answers built in.",
    graphic: HostedSiteGraphic,
    icon: "i-lucide:globe",
    link: links.product.pages
  },
  {
    title: "Content API.",
    text: "Fetch documents and properties into any website or app.",
    graphic: ContentAPIGraphic,
    icon: "i-lucide:code-xml",
    link: links.product.developers
  },
  {
    title: "Custom channels.",
    text: "Serve different versions to previews, releases, or apps.",
    graphic: PublishingGraphic,
    icon: "i-lucide:radio",
    link: links.product.developers
  },
  {
    title: "Keep track of your work.",
    text: "Choose what's published and know every step of what's in the works.",
    graphic: HistoryGraphic,
    icon: "i-lucide:history",
    link: links.product.editor
  },
  {
    title: "Your content. Your format.",
    text: "Export documents and custom blocks as Markdown, MDX, or your own format.",
    graphic: TransformerGraphic,
    icon: "i-lucide:file-code",
    link: links.product.developers
  },
  {
    title: "Sync with GitHub.",
    text: "Markdown or MDX in your repo. Publishes become commits, pushes become edits.",
    graphic: GitHubSyncGraphic,
    icon: "i-mdi:github",
    link: links.product.extensions
  }
];

const Publishing: Component = () => (
  <section
    id="features"
    aria-labelledby="features-title"
    class="relative flex flex-col gap-6 isolate md:gap-8"
  >
    <div class="mx-auto w-full max-w-5xl px-4 md:px-8">
      <SectionHeadline
        id="features-title"
        title="From editor to product."
        subtitle="A docs site, your app, or your repo."
      />
    </div>
    <CardStrip id="publishing-strip" label="Publishing features" cards={stages} />
  </section>
);

export { Publishing };
