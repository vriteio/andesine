import type { Editor } from "@tiptap/core";
import type { EditorView } from "@codemirror/view";
import { invalidateBlockControlLayout } from "../../block-control-sizing";

const createCodeBlockViewport = (editor: Editor, dom: HTMLElement, code: EditorView) => {
  const spacer = document.createElement("div");
  const observer = new ResizeObserver(() => scheduleLayout());

  let frame: number | null = null;
  let container: HTMLElement | null = null;
  let parent: HTMLElement | null = null;
  let initialized = false;

  const updateLayout = () => {
    const nextContainer = dom.closest<HTMLElement>("[data-editor-scrollable-container]");
    const nextParent = dom.parentElement;

    frame = null;
    if (!dom.isConnected || !nextContainer || !nextParent) return;

    if (nextContainer !== container) {
      if (container) observer.unobserve(container);
      container = nextContainer;
      observer.observe(container);
    }
    if (nextParent !== parent) {
      if (parent) observer.unobserve(parent);
      parent = nextParent;
      observer.observe(parent);
    }

    const rect = dom.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const styles = getComputedStyle(dom);
    const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const inset =
      rect.left + parseFloat(styles.paddingLeft) - containerRect.left - container.clientLeft;
    const gutters = code.scrollDOM.querySelector(".cm-gutters");
    const scrollStart = Math.max(0, 24 - inset);
    const atStart =
      code.scrollDOM.scrollLeft <= Number(code.scrollDOM.dataset.codeScrollStart || 0) + 1;
    const width = `${container.clientWidth}px`;
    const margin = `${-inset}px`;
    const leftSpace = `${Math.max(24, inset)}px`;
    const contentWidth = `${Math.max(0, dom.clientWidth - padding - (gutters?.clientWidth || 0))}px`;
    const changed =
      code.dom.style.width !== width ||
      code.dom.style.marginLeft !== margin ||
      code.dom.style.getPropertyValue("--code-left-space") !== leftSpace ||
      code.dom.style.getPropertyValue("--code-content-width") !== contentWidth;

    if (changed) {
      code.dom.style.width = width;
      code.dom.style.marginLeft = margin;
      code.dom.style.setProperty("--code-left-space", leftSpace);
      code.dom.style.setProperty("--code-content-width", contentWidth);
      invalidateBlockControlLayout(editor);
      code.requestMeasure();
    }
    code.scrollDOM.dataset.codeScrollStart = String(scrollStart);
    if (!initialized || atStart) code.scrollDOM.scrollLeft = scrollStart;
    initialized = true;
  };
  const scheduleLayout = () => {
    if (frame === null) frame = requestAnimationFrame(updateLayout);
  };

  spacer.className = "code-block-scroll-spacer";
  spacer.setAttribute("aria-hidden", "true");
  code.scrollDOM.prepend(spacer);
  observer.observe(dom);
  observer.observe(code.contentDOM);
  editor.on("transaction", scheduleLayout);
  window.addEventListener("resize", scheduleLayout);
  scheduleLayout();

  return () => {
    observer.disconnect();
    editor.off("transaction", scheduleLayout);
    window.removeEventListener("resize", scheduleLayout);
    if (frame !== null) cancelAnimationFrame(frame);
    spacer.remove();
  };
};

export { createCodeBlockViewport };
