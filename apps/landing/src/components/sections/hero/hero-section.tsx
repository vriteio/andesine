import { Screenshot, ScreenshotDots } from "../../shared/screenshot";
import styles from "./hero-section.module.scss";
import { type Component, type JSX } from "solid-js";
import clsx from "clsx";

interface HeroSectionProps {
  heading?: JSX.Element;
  ribbon?: JSX.Element;
}

const HeroSection: Component<HeroSectionProps> = (props) => (
  <section aria-labelledby="hero-title" class="relative isolate pt-32 md:pt-40">
    <div class="relative z-2 mx-auto w-full max-w-5xl px-4 md:px-8">
      <div class="flex max-w-3xl flex-col gap-3">
        {props.heading}
        <p
          class="max-w-xl text-base leading-relaxed text-gray-500"
          data-entry="up"
          data-entry-delay="125"
        >
          Write with your team, shape content around your product, and publish it wherever your
          audience needs it.
        </p>
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
          {/* Capture reference: 1440 × 900 light-theme Andesine workspace, showing the collection sidebar, a document with custom fields, and the editor. Use sample content without personal data. */}
          <Screenshot
            src="/_landing/screenshots/workspace.png"
            label="Andesine workspace"
            width={1440}
            height={900}
            eager
            fade
            entry="hero"
            class="relative z-2 aspect-[8/5] w-full rounded-r-none! md:aspect-auto md:rounded-r-2xl!"
            imageClass="absolute left-0 top-0 w-[150%]! max-w-none! md:static md:w-full! md:max-w-full!"
          />
        </div>
      </div>
    </div>
  </section>
);

export { HeroSection };
