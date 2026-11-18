import { FeatureCard, type FeatureCardProps } from "../shared/feature-card";
import { HostedSiteGraphic } from "../shared/feature-graphics";
import {
  TemplateGraphic,
  SiteSearchGraphic,
  BrandGraphic,
  DomainGraphic
} from "../shared/feature-graphics/site";
import { Screenshot } from "../shared/screenshot";
import { Section } from "../shared/section";
import { type Component, For } from "solid-js";

const publishOptions: FeatureCardProps[] = [
  {
    title: "Live in a click.",
    text: "Turn your docs into a site in one click. Every update goes live when you publish.",
    graphic: HostedSiteGraphic
  },
  {
    title: "Make it your own.",
    text: "Start from our open-source template and shape every page to fit your product.",
    graphic: TemplateGraphic
  }
];
const siteFeatures: FeatureCardProps[] = [
  {
    title: "Answers, not just results.",
    text: "Readers ask a question and get an answer with sources.",
    graphic: SiteSearchGraphic
  },
  {
    title: "Looks like you.",
    text: "Your logo, colors, and links on every page.",
    graphic: BrandGraphic
  },
  {
    title: "On your domain.",
    text: "Serve your docs from your own address.",
    graphic: DomainGraphic
  }
];

const PagesOptions: Component = () => (
  <Section
    id="pages-options-title"
    title="Two ways to go live."
    subtitle="Let us run it, or make it your own."
  >
    <div class="grid gap-4 md:grid-cols-2">
      <For each={publishOptions}>
        {(option, index) => <FeatureCard {...option} entryDelay={index() * 125} />}
      </For>
    </div>
  </Section>
);
const PagesFeatures: Component = () => (
  <Section
    id="pages-features-title"
    title="Everything readers need."
    subtitle="Without the extra work."
  >
    <div class="grid gap-4 md:grid-cols-3">
      <For each={siteFeatures}>
        {(feature, index) => <FeatureCard {...feature} entryDelay={index() * 125} />}
      </For>
    </div>
  </Section>
);
const PagesReference: Component = () => (
  <Section
    id="pages-reference-title"
    title="API docs, side by side."
    subtitle="Your API reference lives right next to your guides."
  >
    <Screenshot
      src="/_landing/screenshots/pages-api-reference.png"
      label="API reference page on an Andesine Pages site"
      width={1512}
      height={982}
      fade
    />
  </Section>
);
export { PagesOptions, PagesFeatures, PagesReference };
