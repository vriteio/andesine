/**
 * Restores the expanded groups of server-rendered navigation trees before the first paint, so
 * groups do not close and reopen while a page loads. The integration inlines it into `<head>`.
 * Trees save their groups under the `data-storage-key` of their root, in session storage.
 */
const saved = new Map<string, Set<string> | undefined>();

const readSaved = (key: string): Set<string> | undefined => {
  if (!saved.has(key)) {
    try {
      const ids: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");

      saved.set(key, Array.isArray(ids) ? new Set(ids.map(String)) : undefined);
    } catch {
      saved.set(key, undefined);
    }
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
// Observer callbacks run before the browser paints, so the first frame shows the saved groups.
const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;

      const groups = node.matches('[data-part="group-content"]')
        ? [node]
        : node.querySelectorAll<HTMLElement>(
            '[data-scope="navigation-tree"][data-part="group-content"]'
          );

      groups.forEach(restoreGroup);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", () => observer.disconnect(), { once: true });
