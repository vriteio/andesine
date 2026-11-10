import { createScrollShadowController, ScrollShadow } from "@andesine/components/fragments";
import { type Component, onCleanup, onMount } from "solid-js";

const getPage = (): HTMLElement | null => {
  return typeof document === "undefined" ? null : document.documentElement;
};

const PageScrollShadows: Component = () => {
  const controller = createScrollShadowController();
  const update = (): void => {
    controller.processScrollState();
  };

  onMount(() => {
    window.addEventListener("scroll", update, { passive: true });
    update();
    onCleanup(() => window.removeEventListener("scroll", update));
  });

  return (
    <>
      <div class="pointer-events-none fixed inset-0 z-30 md:hidden">
        <ScrollShadow
          controller={controller}
          scrollableContainerRef={getPage}
          offset={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
          show={{ bottom: false }}
        />
      </div>
      <div class="pointer-events-none fixed inset-0 z-30 hidden md:block">
        <ScrollShadow controller={controller} scrollableContainerRef={getPage} />
      </div>
    </>
  );
};

export { PageScrollShadows };
