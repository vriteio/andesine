import type { Editor } from "@tiptap/core";
import type { Decoration } from "@tiptap/pm/view";
import { createSignal, type Owner, untrack } from "solid-js";
import { render } from "solid-js/web";
import type { EditorDiffChange } from "../../client-types";
import { getCachedElementRect } from "../../ui/block-control-sizing";
import { createBlockSelectionShade } from "../../ui/block-selection/shade";
import { getTableElement } from "../../ui/views/table-view/scroll";
import { VersionDiffBadges } from "./badges";

const createTableDiffView = (
  editor: Editor,
  dom: HTMLElement,
  scrollContainer: HTMLElement,
  owner: unknown
) => {
  const shade = createBlockSelectionShade(scrollContainer, "version-diff-table-shade");
  const badge = document.createElement("span");
  const [types, setTypes] = createSignal<Array<EditorDiffChange["type"]>>([]);

  badge.className =
    "version-diff-badges-anchor version-diff-badges-anchor-block version-diff-badges-anchor-nested";
  badge.contentEditable = "false";
  badge.hidden = true;
  dom.appendChild(badge);

  const unmount = render(() => <VersionDiffBadges types={types()} />, badge, undefined, {
    owner: owner as Owner
  });
  const refresh = () => {
    const table = getTableElement(dom);

    // Node-view updates can run inside the editor's creation memo.
    if (!untrack(types).length || !table || !dom.isConnected) {
      shade.hide();
      badge.hidden = true;
      return;
    }

    shade.show(editor, [dom]);
    badge.hidden = scrollContainer.scrollWidth > scrollContainer.clientWidth;
    if (badge.hidden) return;

    const tableRect = getCachedElementRect(editor, table);
    const nodeRect = getCachedElementRect(editor, dom);

    badge.style.top = `${tableRect.top - nodeRect.top}px`;
  };

  return {
    badge,
    refresh,
    update(decorations: readonly Decoration[]) {
      const type: unknown = decorations.find((decoration) => decoration.spec.tableDiff)?.spec
        .tableDiff;
      const validType = type === "added" || type === "removed" || type === "modified";

      setTypes(validType ? [type] : []);
      shade.element.className = validType
        ? `version-diff-table-shade version-diff-${type}`
        : "version-diff-table-shade";
      refresh();
    },
    destroy() {
      shade.remove();
      unmount();
      badge.remove();
    }
  };
};

export { createTableDiffView };
