import { type Component, type ParentComponent } from "solid-js";
import clsx from "clsx";

interface SectionHeadlineProps {
  id: string;
  title: string;
  subtitle: string;
}

interface SectionProps extends SectionHeadlineProps {
  sectionId?: string;
  class?: string;
}

// Shared gradient title, subtitle, width, spacing, and accessible heading association.
const SectionHeadline: Component<SectionHeadlineProps> = (props) => (
  <h2
    id={props.id}
    class="relative max-w-xl text-2xl font-medium leading-snug md:max-w-3/5 md:text-3xl z-1"
    data-entry="left"
    data-entry-delay="250"
  >
    <span class="bg-gradient-to-tr bg-clip-text text-transparent">{props.title}</span>
    <br />
    {props.subtitle}
  </h2>
);

const Section: ParentComponent<SectionProps> = (props) => (
  <section
    id={props.sectionId}
    aria-labelledby={props.id}
    class={clsx(
      "mx-auto w-full max-w-5xl px-4 md:px-8 relative flex flex-col gap-6 md:gap-8",
      props.class
    )}
  >
    <SectionHeadline id={props.id} title={props.title} subtitle={props.subtitle} />
    {props.children}
  </section>
);

export { Section, SectionHeadline, type SectionProps };
