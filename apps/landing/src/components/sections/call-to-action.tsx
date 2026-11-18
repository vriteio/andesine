import { Section } from "../shared/section";
import { links } from "../../links";
import { ActionButton } from "../shared/action-button";
import { type Component } from "solid-js";

const CallToAction: Component = () => (
  <Section
    class="pb-20 md:pb-24"
    id="cta-title"
    title="Bring your content together."
    subtitle="Start free in the cloud, or host it yourself."
  >
    <div class="grid w-full gap-4 md:max-w-3/4 md:grid-cols-2">
      <ActionButton
        primary
        link={links.cloudSignUp}
        icon="i-lucide:pen-line"
        title="Start writing"
      />
      <ActionButton
        link={links.repository}
        icon="i-mdi:github"
        title="Explore on GitHub"
        entryDelay={125}
      />
    </div>
  </Section>
);

export { CallToAction };
