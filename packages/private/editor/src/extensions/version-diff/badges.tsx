import { Tooltip } from "@andesine/components";
import { For, onMount, onCleanup } from "solid-js";
import type { Editor } from "@tiptap/core";
import type { EditorDiffChange } from "../../client-types";

interface VersionDiffBadgesProps {
  alignToBlock?: boolean;
  editor?: Editor;
  getPos?(): number | undefined;
  types: Array<EditorDiffChange["type"]>;
}

const CHANGE_ICONS: Record<EditorDiffChange["type"], string> = {
  added: "i-lucide:plus",
  modified: "i-lucide:circle",
  removed: "i-lucide:minus"
};
const VersionDiffBadges = (props: VersionDiffBadgesProps) => {
  let badges: HTMLSpanElement | undefined;

  onMount(() => {
    if (!props.alignToBlock || !props.editor) return;

    const editor = props.editor;
    let disposed = false;

    const refresh = () => {
      const anchor = badges?.parentElement;

      if (disposed || editor.isDestroyed || !badges || !anchor?.isConnected) return;

      const pos = props.getPos?.();
      const block = typeof pos === "number" ? editor.view.nodeDOM(pos) : null;

      if (!(block instanceof HTMLElement)) return;

      badges.style.top = `${block.getBoundingClientRect().top - anchor.getBoundingClientRect().top}px`;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);

    queueMicrotask(() => {
      if (disposed || editor.isDestroyed) return;

      const pos = props.getPos?.();
      const block = typeof pos === "number" ? editor.view.nodeDOM(pos) : null;

      observer?.observe(editor.view.dom);
      if (block instanceof HTMLElement) observer?.observe(block);
      refresh();
    });
    editor.on("transaction", refresh);
    window.addEventListener("resize", refresh);
    onCleanup(() => {
      disposed = true;
      observer?.disconnect();
      editor.off("transaction", refresh);
      window.removeEventListener("resize", refresh);
    });
  });

  return (
    <span ref={badges} class="version-diff-badges">
      <For each={props.types}>
        {(type) => {
          const label = `${type[0].toUpperCase()}${type.slice(1)}`;

          return (
            <Tooltip content={label} placement="top" wrapperClass="shrink-0" fixed>
              <span class={`version-diff-badge version-diff-badge-${type}`} aria-label={label}>
                <span class={`version-diff-badge-icon ${CHANGE_ICONS[type]}`} />
              </span>
            </Tooltip>
          );
        }}
      </For>
    </span>
  );
};

export { VersionDiffBadges };
