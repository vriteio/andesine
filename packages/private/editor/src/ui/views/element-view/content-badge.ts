import type { Editor } from "@tiptap/core";
import type { ElementViews } from "#editor/client-types";
import { getElementIssue } from "#editor/lib/element-content";

interface ElementContentBadgeOptions {
  editor: Editor;
  getPos(): number | undefined;
  elementViews?: ElementViews;
}
interface ElementContentBadge {
  dom: HTMLElement;
  update(): void;
}

/**
 * A warning in the gutter, like heading levels, on an element with blocks that its content rules
 * don't accept. Hovering the block shows its drag handle there, whose menu cleans up.
 */
const createElementContentBadge = (options: ElementContentBadgeOptions): ElementContentBadge => {
  const badge = document.createElement("div");
  const frame = document.createElement("span");
  const icon = document.createElement("span");

  badge.className = "element-content-badge";
  badge.contentEditable = "false";
  badge.role = "img";
  badge.hidden = true;
  frame.className = "element-content-badge-frame";
  icon.className = "i-lucide:triangle-alert h-4.5 w-4.5";
  frame.append(icon);
  badge.append(frame);

  return {
    dom: badge,
    update() {
      const pos = options.getPos();
      const { doc } = options.editor.state;
      const issue =
        typeof pos === "number" && options.elementViews
          ? getElementIssue(doc, pos, options.elementViews)
          : null;

      badge.hidden = !issue;
      badge.setAttribute("aria-label", issue?.message ?? "");
    }
  };
};

export { createElementContentBadge };
