import type { Editor } from "@tiptap/core";
import type { Decoration } from "@tiptap/pm/view";
import { createBlockSelectionShade } from "#editor/ui/block-selection/shade";
import { getTableElement } from "./scroll";

/** In the scroll container, so it scrolls with the table. */
const createTableCommentShade = (
  editor: Editor,
  dom: HTMLElement,
  scrollContainer: HTMLElement
) => {
  const shade = createBlockSelectionShade(scrollContainer, "comment-table-shade");

  let comment: "thread" | "draft" | null = null;

  const refresh = () => {
    if (!comment || !getTableElement(dom) || !dom.isConnected) {
      shade.hide();
      return;
    }

    shade.show(editor, [dom]);
  };

  return {
    refresh,
    update(decorations: readonly Decoration[]) {
      const comments = decorations.map(({ spec }) => spec.comment as unknown);

      comment = comments.includes("draft")
        ? "draft"
        : comments.includes("thread")
          ? "thread"
          : null;
      shade.element.classList.toggle("comment-draft", comment === "draft");
      shade.element.classList.toggle(
        "comment-active",
        decorations.some(({ spec }) => spec.active === true)
      );
      refresh();
    },
    destroy: () => shade.remove()
  };
};

export { createTableCommentShade };
