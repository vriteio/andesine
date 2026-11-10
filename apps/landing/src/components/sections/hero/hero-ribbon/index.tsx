import styles from "./styles.module.scss";
import { type Component, createSignal, onCleanup, onMount } from "solid-js";
import clsx from "clsx";

const HeroRibbon: Component = () => {
  const [ready, setReady] = createSignal(false);

  let canvas: HTMLCanvasElement | undefined;

  onMount(() => {
    let disposed = false;
    let disposeScene: (() => void) | undefined;

    onCleanup(() => {
      disposed = true;
      disposeScene?.();
    });

    import("../ribbon-scene")
      .then(({ createRibbonScene }) => {
        if (disposed || !canvas) return;

        disposeScene = createRibbonScene(canvas, () => {
          if (!disposed) setReady(true);
        });
      })
      .catch(() => {
        // Leave the decoration hidden if the optional renderer is unavailable.
      });
  });

  return (
    <div
      aria-hidden="true"
      class={clsx(
        styles.ribbon,
        "pointer-events-none absolute left-1/2 top-1/2 h-32 w-[calc(112%+6rem)] -translate-x-1/2 -translate-y-1/2 -rotate-8 md:h-48"
      )}
      data-ribbon-ready={ready()}
      style={{ opacity: ready() ? 1 : 0 }}
    >
      <canvas ref={canvas} class="absolute inset-0 h-full w-full" />
    </div>
  );
};

export { HeroRibbon };
