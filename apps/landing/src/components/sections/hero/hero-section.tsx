import { Screenshot, ScreenshotDots } from "../../shared/screenshot";
import { links } from "../../../links";
import styles from "./hero-section.module.scss";
import { Button } from "@andesine/components/primitives";
import { type Component, type JSX, Show } from "solid-js";
import clsx from "clsx";

interface HeroSectionProps {
  heading: string;
  highlight: string;
  subheading: string;
  secondaryLabel: string;
  secondaryLink: string;
  secondaryIcon?: string;
  screenshot: string;
  screenshotLabel: string;
  ribbon?: JSX.Element;
}

const HeroSection: Component<HeroSectionProps> = (props) => (
  <section aria-labelledby="hero-title" class="relative isolate pt-32 md:pt-40">
    <div class="relative z-2 mx-auto w-full max-w-5xl px-4 md:px-8">
      <div class="relative isolate mx-auto flex max-w-4xl flex-col items-start gap-3 text-left md:items-center md:text-center">
        <h1
          id="hero-title"
          class="relative z-1 text-4xl font-medium leading-tight md:text-6xl"
          data-entry="up"
        >
          {props.heading}
          <br />
          <span class="bg-gradient-to-tr bg-clip-text text-transparent font-bold">
            {props.highlight}
          </span>
        </h1>
        <p
          class="relative max-w-2xl text-lg leading-relaxed text-gray-500 md:text-xl"
          data-entry="up"
          data-entry-delay="125"
        >
          {/* Soft page-colored halos keep the ribbon from cutting the contrast of the line and buttons. */}
          <span
            aria-hidden="true"
            class="absolute -inset-x-4 -inset-y-2 -z-1 rounded-full bg-gray-50 blur-lg"
          />
          {props.subheading}
        </p>
        <div
          class="relative mt-3 flex flex-wrap gap-2 md:justify-center"
          data-entry="up"
          data-entry-delay="250"
        >
          <div
            aria-hidden="true"
            class="absolute -inset-x-6 -inset-y-3 -z-1 rounded-full bg-gray-50 blur-lg"
          />
          <Button link={links.cloudSignUp} variant="primary" size="medium" class="px-3">
            Start writing
          </Button>
          <Button
            link={props.secondaryLink}
            target={props.secondaryLink.startsWith("http") ? "_blank" : undefined}
            variant="secondary"
            size="medium"
            class="flex items-center gap-1.5 px-3"
          >
            <Show when={props.secondaryIcon}>
              <span aria-hidden="true" class={clsx(props.secondaryIcon, "h-5 w-5")} />
            </Show>
            {props.secondaryLabel}
          </Button>
        </div>
      </div>
    </div>
    <div class="relative z-1 h-20 md:h-32">
      {/* Taller than the row, so the fade doesn't clip the tilted ribbon. */}
      <div class={clsx(styles.ribbonFade, "absolute inset-x-0 -inset-y-24")}>{props.ribbon}</div>
    </div>
    <div class="relative mx-auto w-full max-w-7xl px-4 md:px-8">
      {/* Share the hero's stacking context: dots below ribbon, screenshot above. */}
      <div class="relative">
        <ScreenshotDots class="z-0" />
        <div class={clsx(styles.screenshotFade, "relative z-2 w-[calc(100%+1rem)] md:w-full")}>
          {/* Capture reference: 1512 × 982 at 2x, light theme. Use sample content without personal data. */}
          <Screenshot
            src={props.screenshot}
            label={props.screenshotLabel}
            width={1440}
            height={900}
            eager
            fade
            entry="hero"
            class="relative z-2 aspect-[8/5] w-full overflow-hidden rounded-r-none! md:aspect-auto md:overflow-visible md:rounded-r-2xl!"
            imageClass="absolute left-0 top-0 w-[150%]! max-w-none! md:static md:w-full! md:max-w-full!"
          />
        </div>
      </div>
    </div>
  </section>
);

export { HeroSection };
