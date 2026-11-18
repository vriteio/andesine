import styles from "./styles.module.scss";
import {
  ContentAPIGraphic,
  PublishingGraphic,
  HistoryGraphic,
  TransformerGraphic,
  HostedSiteGraphic,
  GitHubSyncGraphic
} from "../../shared/feature-graphics";
import { FeatureCard, type FeatureCardProps } from "../../shared/feature-card";
import { SectionHeadline } from "../../shared/section";
import { links } from "../../../links";
import { IconButton } from "@andesine/components/primitives";
import { type Component, createSignal, For, onCleanup, onMount } from "solid-js";
import clsx from "clsx";

interface PublishingStage extends FeatureCardProps {
  icon: string;
  link: string;
}

const stages: PublishingStage[] = [
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
          subtitle="A docs site, your app, or your repo."
        />
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
                <a href={stage.link} class="group block h-full">
                  <FeatureCard
                    title={stage.title}
                    text={stage.text}
                    graphic={stage.graphic}
                    entryDelay={Math.min(index(), 2) * 125}
                    marker={
                      <>
                        <span class={clsx(stage.icon, "h-4 w-4 shrink-0 text-tertiary")} />
                        <span class="order-last i-lucide:arrow-up-right h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-tertiary" />
                      </>
                    }
                  />
                </a>
              </li>
            )}
          </For>
        </ol>
      </div>
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 md:gap-8 md:px-8">
        <div class="flex flex-wrap items-center justify-end gap-3">
          <div class="flex gap-2">
            <IconButton
              icon="i-lucide:arrow-left"
              aria-label="Previous publishing feature"
              aria-controls="publishing-strip"
              text="base"
              size="medium"
              disabled={atStart()}
              onClick={() => move(-1)}
            />
            <IconButton
              icon="i-lucide:arrow-right"
              aria-label="Next publishing feature"
              aria-controls="publishing-strip"
              text="base"
              size="medium"
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
