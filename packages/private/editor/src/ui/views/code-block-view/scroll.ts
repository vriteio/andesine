import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";

const codeBlockScrollShadows = ViewPlugin.fromClass(
  class {
    readonly left = document.createElement("div");
    readonly right = document.createElement("div");
    readonly resize = new ResizeObserver(() => this.measure());

    constructor(readonly view: EditorView) {
      const classes =
        "absolute z-3 w-8 pointer-events-none transition-opacity duration-150 from-gray-50 to-gray-50/0";
      const gutters = view.scrollDOM.querySelector(".cm-gutters");

      this.left.className = `${classes} bg-gradient-to-r`;
      this.right.className = `${classes} bg-gradient-to-l`;
      this.left.setAttribute("aria-hidden", "true");
      this.right.setAttribute("aria-hidden", "true");
      view.dom.append(this.left, this.right);
      view.scrollDOM.addEventListener("scroll", this.measure, { passive: true });
      this.resize.observe(view.scrollDOM);
      this.resize.observe(view.contentDOM);
      if (gutters) this.resize.observe(gutters);
      this.measure();
    }

    measure = (): void => {
      this.view.requestMeasure({
        key: this,
        read: (view) => {
          const scroller = view.scrollDOM;
          const bounds = view.dom.getBoundingClientRect();
          const scrollBounds = scroller.getBoundingClientRect();
          const gutters = scroller.querySelector(".cm-gutters")?.getBoundingClientRect();
          const content = view.contentDOM.getBoundingClientRect();
          const backgroundLeft = Math.max(0, (gutters?.left ?? content.left) - bounds.left - 8);
          const backgroundRight = Math.min(scroller.clientWidth, content.right - bounds.left + 8);
          const nodeBounds = view.dom.parentElement?.getBoundingClientRect();

          return {
            left: (gutters?.right ?? scrollBounds.left) - bounds.left,
            right: bounds.right - scrollBounds.left - scroller.clientWidth,
            top: scrollBounds.top - bounds.top,
            height: scroller.clientHeight,
            backgroundLeft,
            visibleLeft: bounds.left - (nodeBounds?.left ?? bounds.left) + backgroundLeft,
            backgroundWidth: Math.max(0, backgroundRight - backgroundLeft),
            atStart: content.left >= (gutters?.right ?? scrollBounds.left) - 1,
            atEnd: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1
          };
        },
        write: (state) => {
          this.view.dom.style.setProperty("--code-background-left", `${state.backgroundLeft}px`);
          this.view.dom.style.setProperty("--code-background-width", `${state.backgroundWidth}px`);
          this.view.dom.parentElement?.style.setProperty(
            "--code-visible-left",
            `${state.visibleLeft}px`
          );
          this.view.dom.parentElement?.style.setProperty(
            "--code-visible-width",
            `${state.backgroundWidth}px`
          );
          this.left.style.left = `${state.left}px`;
          this.right.style.right = `${state.right}px`;
          this.left.style.opacity = state.atStart ? "0" : "1";
          this.right.style.opacity = state.atEnd ? "0" : "1";
          for (const shadow of [this.left, this.right]) {
            shadow.style.top = `${state.top}px`;
            shadow.style.height = `${state.height}px`;
          }
        }
      });
    };

    update(update: ViewUpdate): void {
      if (update.docChanged || update.geometryChanged) this.measure();
    }

    destroy(): void {
      this.resize.disconnect();
      this.view.scrollDOM.removeEventListener("scroll", this.measure);
      this.left.remove();
      this.right.remove();
    }
  }
);

export { codeBlockScrollShadows };
