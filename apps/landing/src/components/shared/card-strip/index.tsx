import styles from "./styles.module.scss";
import { FeatureCard, type FeatureCardProps } from "../feature-card";
import { IconButton } from "@andesine/components/primitives";
import { type Component, createSignal, For, onCleanup, onMount } from "solid-js";
import { Dynamic } from "solid-js/web";
import clsx from "clsx";

interface StripCard extends FeatureCardProps {
  icon?: string;
  link?: string;
}
interface CardStripProps {
  id: string;
  label: string;
  cards: StripCard[];
}

// A native horizontal rail of feature cards, with previous and next buttons.
const CardStrip: Component<CardStripProps> = (props) => {
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
    <>
      {/* Native scrolling remains available without JavaScript. */}
      <div
        id={props.id}
        ref={viewport}
        class={clsx(
          styles.rail,
          "mx-auto w-full max-w-[2135px] overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
        )}
        role="region"
        aria-label={props.label}
        tabIndex={0}
        onScroll={updateControls}
      >
        <ol ref={track} class="grid w-max grid-flow-col auto-cols-[min(82vw,25rem)] gap-8 py-3">
          <For each={props.cards}>
            {(card, index) => {
              // Built once: FeatureDescription reads the marker twice, which would duplicate it in hydration.
              const marker = card.icon ? (
                <>
                  <span class={clsx(card.icon, "h-4 w-4 shrink-0 text-tertiary")} />
                  <span class="order-last i-lucide:arrow-up-right h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-tertiary" />
                </>
              ) : undefined;

              return (
                <li class="relative min-w-0 snap-start">
                  <Dynamic
                    component={card.link ? "a" : "div"}
                    href={card.link}
                    class="group block h-full"
                  >
                    <FeatureCard
                      title={card.title}
                      text={card.text}
                      graphic={card.graphic}
                      entryDelay={Math.min(index(), 2) * 125}
                      marker={marker}
                    />
                  </Dynamic>
                </li>
              );
            }}
          </For>
        </ol>
      </div>
      <div class="mx-auto flex w-full max-w-5xl justify-end gap-2 px-4 md:px-8">
        <IconButton
          icon="i-lucide:arrow-left"
          aria-label="Previous card"
          aria-controls={props.id}
          text="base"
          size="medium"
          disabled={atStart()}
          onClick={() => move(-1)}
        />
        <IconButton
          icon="i-lucide:arrow-right"
          aria-label="Next card"
          aria-controls={props.id}
          text="base"
          size="medium"
          disabled={atEnd()}
          onClick={() => move(1)}
        />
      </div>
    </>
  );
};

export { CardStrip, type StripCard };
