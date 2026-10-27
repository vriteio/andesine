import type { Editor } from "@tiptap/core";
import { getCachedElementRect } from "#editor/ui/block-control-sizing";
import { getTableElement, getTableScrollContainer } from "#editor/ui/views/table-view/scroll";

interface BlockSelectionShadeSegment {
  /** Blocks with their own `selectable` UI, e.g. file tree rows; the shade spans their boxes. */
  boxes: HTMLElement[];
  first: HTMLElement;
  last: HTMLElement;
  table: HTMLTableElement | null;
  tableContainer: HTMLElement | null;
}

/** Whether the block has its own `selectable` UI, e.g. a file tree row or an accordion's header. */
const hasSelectableUI = (block: HTMLElement): boolean => {
  const areas = block.querySelectorAll("[data-block-area][data-block-selectable]");

  return Array.from(areas).some((area) => area.closest("[data-element-node-view]") === block);
};
const ELEMENT_VIEW = "[data-element-view]";

const createBlockSelectionShade = (
  container: HTMLElement,
  className: string,
  { prepend = false }: { prepend?: boolean } = {}
) => {
  const createElement = () => {
    const element = document.createElement("div");

    element.className = className;
    element.hidden = true;
    element.setAttribute("aria-hidden", "true");

    return element;
  };
  const element = createElement();
  const elements = [element];

  let currentBlocks: HTMLElement[] = [];
  let currentEditor: Editor | null = null;
  let currentSegments: BlockSelectionShadeSegment[] = [];

  if (prepend) {
    container.prepend(element);
  } else {
    container.append(element);
  }

  const getFragment = (block: HTMLElement): HTMLElement | null => {
    if (block.matches("[data-fragment-node-view]")) return block;

    return block.querySelector<HTMLElement>("[data-fragment-node-view]");
  };
  const getFirstVisualBlock = (block: HTMLElement): HTMLElement => {
    const fragment = getFragment(block);

    if (!fragment) return block;

    return fragment.querySelector<HTMLElement>("[data-fragment-header]") || block;
  };
  const getLastVisualBlock = (block: HTMLElement): HTMLElement => {
    const fragment = getFragment(block);

    if (!fragment) return block;

    const content = fragment.querySelector<HTMLElement>("[data-node-view-content]");

    return content?.lastElementChild instanceof HTMLElement ? content.lastElementChild : block;
  };
  const getSegments = (): BlockSelectionShadeSegment[] => {
    const segments: BlockSelectionShadeSegment[] = [];

    currentBlocks.forEach((block) => {
      const table = getTableElement(block);
      const tableContainer = getTableScrollContainer(block);

      if (table && tableContainer) {
        segments.push({ boxes: [], first: block, last: block, table, tableContainer });
        return;
      }

      const previous = segments[segments.length - 1];
      const boxes = hasSelectableUI(block) ? [block] : [];
      const joinsPrevious =
        previous &&
        !previous.table &&
        !previous.first.matches("[data-code-block]") &&
        !block.matches("[data-code-block]");

      if (joinsPrevious) {
        previous.last = block;
        previous.boxes.push(...boxes);
      } else {
        segments.push({ boxes, first: block, last: block, table: null, tableContainer: null });
      }
    });

    return segments;
  };
  const mountElement = (shade: HTMLElement, target: HTMLElement) => {
    if (shade.parentElement === target) return;

    if (prepend) {
      target.prepend(shade);
    } else {
      target.append(shade);
    }
  };
  const positionStandardSegment = (shade: HTMLElement, segment: BlockSelectionShadeSegment) => {
    if (!currentEditor) return;

    if (segment.first.matches("[data-code-block]")) {
      mountElement(shade, segment.first);

      delete shade.dataset.tableSelectionShade;

      shade.style.height = "100%";
      shade.style.width = "var(--code-visible-width, 100%)";
      shade.style.left = "var(--code-visible-left, 0px)";
      shade.style.top = "0";

      return;
    }

    const editor = currentEditor;
    const containerRect = getCachedElementRect(editor, container);
    const editorRect = getCachedElementRect(editor, editor.view.dom);
    // Blocks have a 4px outset; items in a view's layout none, e.g. close file tree rows.
    const getOutset = (block: HTMLElement) => {
      const isViewItem =
        segment.boxes.includes(block) && block.parentElement?.closest(ELEMENT_VIEW);

      return isViewItem ? 0 : 4;
    };
    // Blocks with their own selectable UI span their whole box, e.g. a folder with its rows.
    const ends = [
      {
        block: segment.first,
        rect: getCachedElementRect(editor, getFirstVisualBlock(segment.first))
      },
      { block: segment.last, rect: getCachedElementRect(editor, getLastVisualBlock(segment.last)) },
      ...segment.boxes.map((block) => ({ block, rect: getCachedElementRect(editor, block) }))
    ].filter(({ rect }) => rect.width);
    const top = Math.min(...ends.map(({ block, rect }) => rect.top - getOutset(block)));
    const bottom = Math.max(...ends.map(({ block, rect }) => rect.bottom + getOutset(block)));

    mountElement(shade, container);
    delete shade.dataset.tableSelectionShade;
    shade.style.height = `${bottom - top}px`;
    shade.style.left = `${editorRect.left - containerRect.left + container.scrollLeft - 8}px`;
    shade.style.top = `${top - containerRect.top + container.scrollTop}px`;
    shade.style.width = `${editorRect.width + 16}px`;
  };
  const positionTableSegment = (shade: HTMLElement, segment: BlockSelectionShadeSegment) => {
    const { table, tableContainer } = segment;

    if (!currentEditor || !table || !tableContainer) return;

    const containerRect = getCachedElementRect(currentEditor, tableContainer);
    const tableRect = getCachedElementRect(currentEditor, table);

    mountElement(shade, tableContainer);
    shade.dataset.tableSelectionShade = "";
    shade.style.height = `${tableRect.height}px`;
    shade.style.left = `${tableRect.left - containerRect.left + tableContainer.scrollLeft}px`;
    shade.style.top = `${tableRect.top - containerRect.top + tableContainer.scrollTop}px`;
    shade.style.width = `${tableRect.width}px`;
  };
  const position = () => {
    if (!currentEditor || !currentBlocks.length) return;

    const segments = currentSegments;

    while (elements.length < segments.length) {
      elements.push(createElement());
    }

    elements.forEach((shade, index) => {
      const segment = segments[index];

      if (!segment) {
        shade.hidden = true;
        return;
      }

      if (shade !== element) {
        shade.style.setProperty(
          "--collaboration-color",
          element.style.getPropertyValue("--collaboration-color")
        );
        if (element.dataset.collaborationClient) {
          shade.dataset.collaborationClient = element.dataset.collaborationClient;
        } else {
          delete shade.dataset.collaborationClient;
        }
      }

      if (segment.table) positionTableSegment(shade, segment);
      else positionStandardSegment(shade, segment);

      shade.hidden = false;
    });
  };
  const show = (editor: Editor, blocks: HTMLElement[]) => {
    const changed =
      blocks.length !== currentBlocks.length ||
      blocks.some((block, index) => block !== currentBlocks[index]);

    currentEditor = editor;
    currentBlocks = blocks;
    if (changed) currentSegments = getSegments();
    // Tables and views can change their layout with the same blocks; their boxes are cached.
    const hasOwnLayout = currentSegments.some(({ table, boxes }) => table || boxes.length);

    if (changed || hasOwnLayout) position();
  };

  return {
    element,
    hide: () => {
      elements.forEach((shade) => (shade.hidden = true));
      currentBlocks = [];
    },
    refresh: position,
    remove: () => elements.forEach((shade) => shade.remove()),
    show
  };
};

export { createBlockSelectionShade };
