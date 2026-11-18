import { links } from "../../links";
import { Button } from "@andesine/components/primitives";
import { type Component, Show } from "solid-js";

interface PageHeroProps {
  heading: string;
  highlight?: string;
  subheading: string;
  secondaryLabel?: string;
  secondaryLink?: string;
}

// The home hero, scaled down for secondary pages: no ribbon or screenshot, a smaller headline.
const PageHero: Component<PageHeroProps> = (props) => (
  <section aria-labelledby="page-title" class="relative isolate pt-32 md:pt-40">
    <div class="mx-auto w-full max-w-5xl px-4 md:px-8">
      <div class="mx-auto flex max-w-3xl flex-col items-start gap-3 text-left md:items-center md:text-center">
        <h1 id="page-title" class="text-4xl font-medium leading-tight md:text-5xl" data-entry="up">
          {props.heading}
          <Show when={props.highlight}>
            <br />
            <span class="bg-gradient-to-tr bg-clip-text font-bold text-transparent">
              {props.highlight}
            </span>
          </Show>
        </h1>
        <p
          class="max-w-xl text-lg leading-relaxed text-gray-500"
          data-entry="up"
          data-entry-delay="125"
        >
          {props.subheading}
        </p>
        <div
          class="mt-3 flex flex-wrap gap-2 md:justify-center"
          data-entry="up"
          data-entry-delay="250"
        >
          <Button link={links.cloudSignUp} variant="primary" size="medium" class="px-3">
            Start writing
          </Button>
          <Show when={props.secondaryLink}>
            <Button link={props.secondaryLink} variant="secondary" size="medium" class="px-3">
              {props.secondaryLabel}
            </Button>
          </Show>
        </div>
      </div>
    </div>
  </section>
);

export { PageHero };
