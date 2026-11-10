/**
 * Restores the expanded groups of server-rendered navigation trees, and the scroll positions of
 * their containers, before the first paint. Groups do not close and reopen, and lists do not jump
 * while a page loads. The integration inlines it into `<head>`. Trees save their groups under the
 * `data-storage-key` of their root, and containers their positions under their `data-scroll-key`,
 * in session storage. Containers also get the edge attributes of Ark scroll areas, which their
 * scroll shadows use, so the shadows match the restored position.
 */
const saved = new Map<string, Set<string> | undefined>();
// Containers keep their position while the parser adds content, which can make them taller.
const scrolled = new Set<HTMLElement>();

const readSession = (key: string): unknown => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null");
  } catch {
    return undefined;
  }
};
const readSaved = (key: string): Set<string> | undefined => {
  if (!saved.has(key)) {
    const ids = readSession(key);

    saved.set(key, Array.isArray(ids) ? new Set(ids.map(String)) : undefined);
  }

  return saved.get(key);
};
/** Groups are restored as the parser adds their content, which follows their triggers. */
const restoreGroup = (content: HTMLElement): void => {
  const item = content.closest<HTMLElement>('[data-scope="navigation-tree"][data-part="item"]');
  const key = content.closest<HTMLElement>("[data-storage-key]")?.dataset.storageKey;
  const ids = key ? readSaved(key) : undefined;

  if (!item || !ids) return;

  // The current page's groups always stay expanded.
  const state =
    ids.has(item.dataset.id ?? "") || item.hasAttribute("data-active") ? "open" : "closed";
  const trigger = document.querySelector(`[aria-controls="${content.id}"]`);

  item.dataset.state = state;
  content.dataset.state = state;
  content.hidden = state === "closed";
  trigger?.setAttribute("data-state", state);
  trigger?.setAttribute("aria-expanded", String(state === "open"));
};
/** Sets the saved position, then keeps the current page in view, like `createScrollMemory`. */
const restoreScroll = (container: HTMLElement): void => {
  const margin = 8;
  const current = container.querySelector('[aria-current="page"]');

  container.scrollTop = Number(readSession(container.dataset.scrollKey ?? "")) || 0;

  if (current) {
    const bounds = container.getBoundingClientRect();
    const target = current.getBoundingClientRect();

    if (target.top < bounds.top + margin) container.scrollTop += target.top - bounds.top - margin;

    if (target.bottom > bounds.bottom - margin) {
      container.scrollTop += target.bottom - bounds.bottom + margin;
    }
  }

  const { scrollTop, scrollHeight, clientHeight } = container;

  container.toggleAttribute("data-overflow-y", scrollHeight > clientHeight);
  container.toggleAttribute("data-at-top", scrollTop <= 0);
  container.toggleAttribute("data-at-bottom", scrollTop + clientHeight >= scrollHeight - 1);
};
// Observer callbacks run before the browser paints, so the first frame shows the saved state.
const observer = new MutationObserver((records) => {
  const changed = new Set<HTMLElement>();

  for (const record of records) {
    // Only containers with new content can have a new height.
    scrolled.forEach((container) => {
      if (container.contains(record.target)) changed.add(container);
    });

    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;

      const groups = node.matches('[data-part="group-content"]')
        ? [node]
        : node.querySelectorAll<HTMLElement>(
            '[data-scope="navigation-tree"][data-part="group-content"]'
          );
      const containers = node.matches("[data-scroll-key]")
        ? [node]
        : node.querySelectorAll<HTMLElement>("[data-scroll-key]");

      groups.forEach(restoreGroup);
      containers.forEach((container) => {
        scrolled.add(container);
        changed.add(container);
      });
    }
  }

  changed.forEach(restoreScroll);
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener(
  "DOMContentLoaded",
  () => {
    observer.disconnect();
    scrolled.forEach(restoreScroll);
  },
  { once: true }
);
