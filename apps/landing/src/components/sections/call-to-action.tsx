import { Section } from "../shared/section";
import { links } from "../../links";
import { ActionButton } from "../shared/action-button";
import { type Component } from "solid-js";

const CallToAction: Component = () => (
  <Section
    class="pb-20 md:pb-24"
    id="cta-title"
    title="Start your next document."
    subtitle="Create in the cloud. Explore the source."
  >
    <div class="grid w-full gap-4 md:max-w-3/4 md:grid-cols-2">
      <ActionButton
        primary
        link={links.cloudSignUp}
        icon="i-lucide:pen-line"
        title="Start writing"
        description="Your workspace for docs, guides, and shared knowledge. Ready in the cloud."
      />
      <ActionButton
        link={links.repository}
        icon="i-mdi:github"
        title="Explore on GitHub"
        description="Read the source, self-host Andesine, or help shape what comes next."
        entryDelay={125}
      />
    </div>
  </Section>
);

export { CallToAction };
