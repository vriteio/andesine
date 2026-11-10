import type { Decoration } from "@tiptap/pm/view";
import { createSignal, type Owner, untrack } from "solid-js";
import { render } from "solid-js/web";
import type { EditorDiffChange } from "../../client-types";
import { VersionDiffBadges } from "./badges";

const createElementDiffView = (
  dom: HTMLElement,
  opening: HTMLElement,
  closing: HTMLElement,
  owner: unknown
) => {
  const [types, setTypes] = createSignal<Array<EditorDiffChange["type"]>>([]);
  let badge: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let unmount: (() => void) | null = null;
  let destroyed = false;

  const refresh = () => {
    if (destroyed || !badge || !dom.isConnected || !untrack(types).length) return;

    const nodeRect = dom.getBoundingClientRect();
    const tagRect = opening.getBoundingClientRect();

    badge.style.left = `${tagRect.left - nodeRect.left}px`;
    badge.style.top = `${tagRect.top - nodeRect.top}px`;
  };

  return {
    update(decorations: readonly Decoration[]) {
      const type: unknown = decorations.find((decoration) => decoration.spec.elementDiff)?.spec
        .elementDiff;
      const valid = type === "added" || type === "removed" || type === "modified";

      opening.className = closing.className =
        type === "modified"
          ? "element-tag version-diff-block version-diff-modified"
          : "element-tag";
      setTypes(valid ? [type] : []);
      if (valid && !badge) {
        badge = document.createElement("span");
        badge.className =
          "version-diff-badges-anchor version-diff-badges-anchor-block version-diff-badges-anchor-nested";
        badge.contentEditable = "false";
        dom.appendChild(badge);
        unmount = render(() => <VersionDiffBadges types={types()} />, badge, undefined, {
          owner: owner as Owner
        });
        observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
        observer?.observe(dom);
        observer?.observe(opening);
        window.addEventListener("resize", refresh);
      }
      if (badge) badge.hidden = !valid;
      queueMicrotask(refresh);
    },
    destroy() {
      destroyed = true;
      observer?.disconnect();
      window.removeEventListener("resize", refresh);
      unmount?.();
      badge?.remove();
    }
  };
};

export { createElementDiffView };
