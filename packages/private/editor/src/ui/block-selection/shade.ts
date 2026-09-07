import type { Editor } from "@tiptap/core";
import { getCachedElementRect } from "#editor/ui/block-control-sizing";
import { getTableElement, getTableScrollContainer } from "#editor/ui/views/table-view/scroll";

interface BlockSelectionShadeSegment {
  first: HTMLElement;
  last: HTMLElement;
  table: HTMLTableElement | null;
  tableContainer: HTMLElement | null;
}

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
        segments.push({ first: block, last: block, table, tableContainer });
        return;
      }

      const previous = segments[segments.length - 1];

      if (previous && !previous.table) {
        previous.last = block;
      } else {
        segments.push({ first: block, last: block, table: null, tableContainer: null });
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

    const first = getFirstVisualBlock(segment.first);
    const last = getLastVisualBlock(segment.last);
    const containerRect = getCachedElementRect(currentEditor, container);
    const editorRect = getCachedElementRect(currentEditor, currentEditor.view.dom);
    const firstRect = getCachedElementRect(currentEditor, first);
    const lastRect = getCachedElementRect(currentEditor, last);

    mountElement(shade, container);
    delete shade.dataset.tableSelectionShade;
    shade.style.height = `${lastRect.bottom - firstRect.top + 8}px`;
    shade.style.left = `${editorRect.left - containerRect.left + container.scrollLeft - 8}px`;
    shade.style.top = `${firstRect.top - containerRect.top + container.scrollTop - 4}px`;
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
    if (changed || currentSegments.some((segment) => segment.table)) position();
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
