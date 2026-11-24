import type { Editor, EditorEvents } from "@tiptap/core";
import type { EditorView } from "@codemirror/view";
import { invalidateBlockControlLayout } from "../../block-control-sizing";
import { getClipContainer } from "../../block-scroll";

const createCodeBlockViewport = (editor: Editor, dom: HTMLElement, code: EditorView) => {
  const spacer = document.createElement("div");
  const observer = new ResizeObserver(() => scheduleLayout(true));

  let frame: number | null = null;
  let container: HTMLElement | null = null;
  let parent: HTMLElement | null = null;
  let initialized = false;
  // The clip container changes only with the layout, e.g. when an element view mounts.
  let resized = true;
  let lastDoc = code.state.doc;

  const updateLayout = () => {
    const isContainerStale = resized || !container?.isConnected;
    const nextContainer = isContainerStale ? getClipContainer(dom) : container;
    const nextParent = dom.parentElement;

    frame = null;
    if (!dom.isConnected || !nextContainer || !nextParent) return;

    resized = false;

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
    // At the scroll's end, the content ends at the column's edge, by the block controls.
    const rightSpace = `${Math.max(24, Math.floor(container.clientWidth - inset - dom.clientWidth + padding))}px`;
    const contentWidth = `${Math.max(0, dom.clientWidth - padding - Math.ceil(gutters?.getBoundingClientRect().width || 0))}px`;
    const changed =
      code.dom.style.width !== width ||
      code.dom.style.marginLeft !== margin ||
      code.dom.style.getPropertyValue("--code-left-space") !== leftSpace ||
      code.dom.style.getPropertyValue("--code-right-space") !== rightSpace ||
      code.dom.style.getPropertyValue("--code-content-width") !== contentWidth;

    if (changed) {
      code.dom.style.width = width;
      code.dom.style.marginLeft = margin;
      code.dom.style.setProperty("--code-left-space", leftSpace);
      code.dom.style.setProperty("--code-right-space", rightSpace);
      code.dom.style.setProperty("--code-content-width", contentWidth);
      invalidateBlockControlLayout(editor);
      code.requestMeasure();
    }
    code.scrollDOM.dataset.codeScrollStart = String(scrollStart);
    if (!initialized || atStart) code.scrollDOM.scrollLeft = scrollStart;
    initialized = true;
  };
  const scheduleLayout = (isResize = false) => {
    resized ||= isResize;
    if (frame === null) frame = requestAnimationFrame(updateLayout);
  };
  const onResize = () => scheduleLayout(true);
  // Only for this block's code, e.g. a new line number digit; the observer sees other changes.
  const onTransaction = ({ transaction }: EditorEvents["transaction"]) => {
    if (!transaction.docChanged) return;

    // After the node view syncs the code into the editor, which it does in a microtask.
    queueMicrotask(() => {
      if (code.state.doc === lastDoc) return;

      lastDoc = code.state.doc;
      scheduleLayout();
    });
  };

  spacer.className = "code-block-scroll-spacer";
  spacer.setAttribute("aria-hidden", "true");
  code.scrollDOM.prepend(spacer);
  observer.observe(dom);
  observer.observe(code.contentDOM);
  editor.on("transaction", onTransaction);
  window.addEventListener("resize", onResize);
  scheduleLayout();

  return () => {
    observer.disconnect();
    editor.off("transaction", onTransaction);
    window.removeEventListener("resize", onResize);
    if (frame !== null) cancelAnimationFrame(frame);
    spacer.remove();
  };
};

export { createCodeBlockViewport };
