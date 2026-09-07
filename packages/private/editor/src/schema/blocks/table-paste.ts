import { Fragment, Slice, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { isInTable } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";

const CELL_BLOCK_SELECTOR = "p, div, h1, h2, h3, h4, h5, h6, blockquote, pre, ul, ol, li";

const normalizePastedCellContent = (slice: Slice, view: EditorView): Slice => {
  const { schema } = view.state;
  const content: ProseMirrorNode[] = [];

  let containsTable = false;
  let hasTextblock = false;

  if (!isInTable(view.state) || !slice.size) return slice;

  slice.content.descendants((node) => {
    if (node.type.spec.tableRole) containsTable = true;

    return !containsTable;
  });

  // Keep copied rows and cells intact for the table paste handler.
  if (containsTable) return slice;

  slice.content.descendants((node) => {
    if (node.isTextblock) {
      if (hasTextblock) content.push(schema.nodes.hardBreak.create());

      node.content.forEach((child) => content.push(child));
      hasTextblock = true;
      return false;
    }

    if (node.isInline) {
      content.push(node);
      return false;
    }

    return true;
  });

  if (!hasTextblock) return slice;

  return new Slice(Fragment.from(schema.nodes.paragraph.create(null, content)), 1, 1);
};

const normalizeCellContent = (cell: HTMLTableCellElement): void => {
  const paragraph = document.createElement("p");

  let hasContent = false;
  let needsBreak = false;

  const appendContent = (source: Element, target: Element): void => {
    Array.from(source.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;

        if (element.matches(CELL_BLOCK_SELECTOR)) {
          if (hasContent) needsBreak = true;
          appendContent(element, target);
          needsBreak = true;
          return;
        }

        const clone = element.cloneNode(false) as Element;

        if (element.tagName === "BR") {
          if (needsBreak && hasContent) target.appendChild(document.createElement("br"));
          needsBreak = false;
          hasContent = true;
        }

        target.appendChild(clone);
        appendContent(element, clone);
      } else if (node.nodeType === Node.TEXT_NODE) {
        if ((!hasContent || needsBreak) && !node.textContent?.trim()) return;

        if (needsBreak && hasContent) target.appendChild(document.createElement("br"));
        target.appendChild(node.cloneNode());
        needsBreak = false;
        hasContent = true;
      }
    });
  };

  appendContent(cell, paragraph);
  cell.replaceChildren(paragraph);
};

const normalizePastedTables = (html: string): string => {
  const template = document.createElement("template");

  template.innerHTML = html;
  template.content.querySelectorAll("table").forEach((table) => {
    const rows = Array.from(table.rows);
    const grid: HTMLTableCellElement[][] = rows.map(() => []);

    rows.forEach((row, rowIndex) => {
      const nextGroup = rows.findIndex((nextRow, index) => {
        return index > rowIndex && nextRow.parentElement !== row.parentElement;
      });
      const remainingRows = (nextGroup === -1 ? rows.length : nextGroup) - rowIndex;

      let column = 0;

      Array.from(row.cells).forEach((cell) => {
        const colspan = cell.colSpan;
        const rowspan = Math.min(cell.rowSpan || remainingRows, remainingRows);
        const widths = cell.getAttribute("colwidth")?.split(",");

        normalizeCellContent(cell);
        while (grid[rowIndex][column]) column += 1;

        for (let y = 0; y < rowspan; y += 1) {
          for (let x = 0; x < colspan; x += 1) {
            const target = y === 0 && x === 0 ? cell : document.createElement(cell.tagName);

            target.removeAttribute("colspan");
            target.removeAttribute("rowspan");
            if (widths?.[x]) target.setAttribute("colwidth", widths[x]);
            else target.removeAttribute("colwidth");

            grid[rowIndex + y][column + x] = target as HTMLTableCellElement;
          }
        }

        column += colspan;
      });
    });

    const width = grid.reduce((maximum, cells) => Math.max(maximum, cells.length), 0);

    rows.forEach((row, index) => {
      const cells = Array.from(
        { length: width },
        (_, column) => grid[index][column] || document.createElement("td")
      );

      row.replaceChildren(...cells);
    });
  });

  return template.innerHTML;
};

export { normalizePastedCellContent, normalizePastedTables };
