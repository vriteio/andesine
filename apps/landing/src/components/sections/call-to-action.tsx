import { Section } from "../shared/section";
import { links } from "../../links";
import { ActionButton } from "../shared/action-button";
import { type Component } from "solid-js";

interface CallToActionProps {
  title?: string;
  subtitle?: string;
  secondaryTitle?: string;
  secondaryLink?: string;
  secondaryIcon?: string;
}

const CallToAction: Component<CallToActionProps> = (props) => (
  <Section
    class="pb-20 md:pb-24"
    id="cta-title"
    title={props.title ?? "Bring your content together."}
    subtitle={props.subtitle ?? "Start free in the cloud, or host it yourself."}
  >
    <div class="grid w-full gap-4 md:max-w-3/4 md:grid-cols-2">
      <ActionButton
        primary
        link={links.cloudSignUp}
        icon="i-lucide:pen-line"
        title="Start writing"
      />
      <ActionButton
        link={props.secondaryLink ?? links.repository}
        icon={props.secondaryIcon ?? "i-mdi:github"}
        title={props.secondaryTitle ?? "Explore on GitHub"}
        entryDelay={125}
      />
    </div>
  </Section>
);

export { CallToAction };
