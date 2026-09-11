import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { CellSelection } from "@tiptap/pm/tables";
import { Decoration } from "@tiptap/pm/view";

const createCollaborationCellDecorations = (
  doc: ProseMirrorNode,
  anchor: number,
  head: number,
  clientID: number,
  color: string
): Decoration[] => {
  const $anchor = doc.resolve(anchor);
  const $head = doc.resolve(head);
  const isCell = (node: ProseMirrorNode | null) => {
    return node?.type.spec.tableRole === "cell" || node?.type.spec.tableRole === "header_cell";
  };
  const decorations: Decoration[] = [];

  // A remote edit can remove a selected cell or move it into another table.
  if (
    !isCell($anchor.nodeAfter) ||
    !isCell($head.nodeAfter) ||
    $anchor.parent.type.spec.tableRole !== "row" ||
    $head.parent.type.spec.tableRole !== "row" ||
    $anchor.depth < 2 ||
    $head.depth < 2 ||
    $anchor.start(-1) !== $head.start(-1)
  ) {
    return decorations;
  }

  new CellSelection($anchor, $head).forEachCell((_cell, pos) => {
    decorations.push(
      Decoration.widget(
        pos + 1,
        () => {
          const shade = document.createElement("span");

          shade.className = "collaboration-cell-selection";
          shade.style.setProperty("--collaboration-color", color);
          shade.setAttribute("aria-hidden", "true");

          return shade;
        },
        { key: `collaboration-cell-${clientID}-${pos}-${color}`, side: -1 }
      )
    );
  });

  return decorations;
};

export { createCollaborationCellDecorations };
