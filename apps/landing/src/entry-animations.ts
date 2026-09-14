// Enhance the static page without hiding content when JavaScript or motion is disabled.
const initEntryAnimations = (): void => {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-entry]"));

  if (motionPreference.matches || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement);
      }
    },
    { rootMargin: "0px 0px -32px 0px", threshold: 0 }
  );
  const reveal = (element: HTMLElement): void => {
    if (element.dataset.entryState !== "pending") return;

    element.dataset.entryState = "visible";
    observer.unobserve(element);
  };
  const revealFocused = (event: FocusEvent): void => {
    const element =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-entry-state]")
        : null;

    if (!element) return;

    // Keyboard navigation must never land in transparent content.
    delete element.dataset.entryState;
    observer.unobserve(element);
  };
  const cleanup = (): void => {
    observer.disconnect();
    elements.forEach((element) => delete element.dataset.entryState);
    document.removeEventListener("focusin", revealFocused);
    motionPreference.removeEventListener("change", cleanup);
    window.removeEventListener("pagehide", cleanup);
  };

  for (const element of elements) {
    element.dataset.entryState = "pending";
    observer.observe(element);
  }

  document.addEventListener("focusin", revealFocused);
  motionPreference.addEventListener("change", cleanup);
  window.addEventListener("pagehide", cleanup, { once: true });
};

export { initEntryAnimations };
