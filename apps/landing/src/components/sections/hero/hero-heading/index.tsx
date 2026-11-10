import styles from "./styles.module.scss";
import { type Component, createSignal, For, onCleanup, onMount } from "solid-js";

const useCases = [
  "product documentation",
  "internal knowledge bases",
  "technical publications",
  "in-product experiences"
];

const HeroHeading: Component = () => {
  const [turn, setTurn] = createSignal(0);

  let container: HTMLDivElement | undefined;

  onMount(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = (): void => {
      window.clearInterval(interval);
      interval = undefined;
    };
    const updatePlayback = (): void => {
      stop();

      if (motionPreference.matches) {
        setTurn(0);
        return;
      }

      if (!visible || document.hidden) return;

      interval = window.setInterval(() => setTurn((value) => value + 1), 4000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    });

    let interval: number | undefined;
    let visible = false;

    if (container) observer.observe(container);

    document.addEventListener("visibilitychange", updatePlayback);
    motionPreference.addEventListener("change", updatePlayback);
    onCleanup(() => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
      motionPreference.removeEventListener("change", updatePlayback);
    });
  });

  return (
    <div ref={container} class="min-w-0 @container">
      <h1 id="hero-title" class="font-medium leading-tight" data-entry="up">
        <span class="sr-only">
          Content workspace for product documentation, internal knowledge bases, technical
          publications, and in-product experiences.
        </span>
        <span aria-hidden="true" class="block whitespace-nowrap text-2xl md:text-3xl">
          Content workspace for
        </span>
        <span aria-hidden="true" class={`${styles.flip} block text-3xl md:text-4xl`}>
          <span class={`${styles.rotator} grid`} style={{ "--rotation": `${turn() * -90}deg` }}>
            <For each={useCases}>
              {(useCase, index) => (
                <span
                  class={`${styles.face} flex items-center whitespace-nowrap bg-gradient-to-tr bg-clip-text text-transparent`}
                  style={{
                    "--face-rotation": `${index() * 90}deg`,
                    "opacity": turn() % useCases.length === index() ? 1 : 0
                  }}
                >
                  {useCase}
                </span>
              )}
            </For>
          </span>
        </span>
      </h1>
    </div>
  );
};

export { HeroHeading };
