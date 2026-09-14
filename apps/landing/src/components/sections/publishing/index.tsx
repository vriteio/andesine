import styles from "./styles.module.scss";
import {
  ContentAPIGraphic,
  PublishingGraphic,
  HistoryGraphic,
  TransformerGraphic,
  GitHubSyncGraphic
} from "../../shared/feature-graphics";
import { FeatureCard, type FeatureCardProps } from "../../shared/feature-card";
import { SectionHeadline } from "../../shared/section";
import { links } from "../../../links";
import { Button, IconButton } from "@andesine/components/primitives";
import { type Component, createSignal, For, onCleanup, onMount } from "solid-js";
import clsx from "clsx";

// Planned launch features: verify transformer outputs and automatic
// Andesine-to-GitHub publishing before publication. Do not imply two-way sync or PR support.
const stages: FeatureCardProps[] = [
  {
    title: "Content API.",
    text: "Read documents, properties, and fragments from your website or app. Build your own content experience.",
    graphic: ContentAPIGraphic
  },
  {
    title: "Custom channels.",
    text: "Serve separate versions of the same content for previews, releases, or different apps. Choose which version each channel publishes.",
    graphic: PublishingGraphic
  },
  {
    title: "Publish the right version.",
    text: "Compare versions and restore earlier drafts. Publish a saved version to a channel while you keep editing the next one.",
    graphic: HistoryGraphic
  },
  {
    title: "Your content. Your format.",
    text: "Transform documents and custom elements into Markdown, MDX, or your own format.",
    graphic: TransformerGraphic
  },
  {
    title: "Publish to GitHub.",
    text: "Automatically sync converted files to your repository for your site to build and publish.",
    graphic: GitHubSyncGraphic
  }
];

const Publishing: Component = () => {
  const [atStart, setAtStart] = createSignal(true);
  const [atEnd, setAtEnd] = createSignal(true);

  let viewport: HTMLDivElement | undefined;
  let track: HTMLOListElement | undefined;

  const updateControls = (): void => {
    if (!viewport) return;

    setAtStart(viewport.scrollLeft <= 1);
    setAtEnd(viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1);
  };
  const move = (direction: number): void => {
    const cards = track
      ? Array.from(track.children).filter(
          (card): card is HTMLElement => card instanceof HTMLElement
        )
      : [];

    if (!viewport || cards.length === 0) return;

    const viewportLeft = viewport.getBoundingClientRect().left;
    const scrollPadding = Number.parseFloat(getComputedStyle(viewport).scrollPaddingLeft) || 0;
    const positions = cards.map((card) => {
      return card.getBoundingClientRect().left - viewportLeft + viewport.scrollLeft - scrollPadding;
    });
    const currentIndex = positions.reduce((nearestIndex, position, index) => {
      const nearestDistance = Math.abs(positions[nearestIndex] - viewport.scrollLeft);
      const distance = Math.abs(position - viewport.scrollLeft);

      return distance < nearestDistance ? index : nearestIndex;
    }, 0);
    const targetIndex = Math.max(0, Math.min(cards.length - 1, currentIndex + direction));

    viewport.scrollTo({
      left: positions[targetIndex],
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
    });
  };

  onMount(() => {
    const observer = new ResizeObserver(updateControls);

    if (viewport) observer.observe(viewport);
    if (track) observer.observe(track);
    updateControls();
    onCleanup(() => observer.disconnect());
  });

  return (
    <section
      id="features"
      aria-labelledby="features-title"
      class="relative flex flex-col gap-6 isolate md:gap-8"
    >
      <div class="mx-auto w-full max-w-5xl px-4 md:px-8">
        <SectionHeadline
          id="features-title"
          title="From editor to product."
          subtitle="Your content, delivered through the API."
        />
        <p class="mt-4 max-w-2xl text-base leading-relaxed text-gray-500" data-entry="left">
          Choose a channel and read published content from your website or app. Need files instead?
          Transform your content and sync it to GitHub.
        </p>
      </div>
      {/* Explanatory diagrams, not product screenshots or a live repository state.
          Native scrolling remains available without JavaScript. */}
      <div
        id="publishing-strip"
        ref={viewport}
        class={clsx(
          styles.rail,
          "mx-auto w-full max-w-[2135px] overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
        )}
        role="region"
        aria-label="Publishing features"
        tabIndex={0}
        onScroll={updateControls}
      >
        <ol ref={track} class="grid w-max grid-flow-col auto-cols-[min(82vw,25rem)] gap-8 py-3">
          <For each={stages}>
            {(stage, index) => (
              <li class="relative min-w-0 snap-start">
                <FeatureCard {...stage} entryDelay={Math.min(index(), 2) * 125} />
              </li>
            )}
          </For>
        </ol>
      </div>
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 md:gap-8 md:px-8">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap gap-2">
            <Button link={links.documentation.api} variant="outlined" color="contrast">
              API documentation
            </Button>
            <Button link={links.documentation.publishing} variant="text">
              Publishing guide
            </Button>
          </div>
          <div class="flex gap-2">
            <IconButton
              icon="i-lucide:arrow-left"
              aria-label="Previous publishing feature"
              aria-controls="publishing-strip"
              color="contrast"
              disabled={atStart()}
              onClick={() => move(-1)}
            />
            <IconButton
              icon="i-lucide:arrow-right"
              aria-label="Next publishing feature"
              aria-controls="publishing-strip"
              color="contrast"
              disabled={atEnd()}
              onClick={() => move(1)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export { Publishing };
