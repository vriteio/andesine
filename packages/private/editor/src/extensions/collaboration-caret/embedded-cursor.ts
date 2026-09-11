import type { HocuspocusProvider } from "@hocuspocus/provider";
import { Plugin } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  yCursorPluginKey,
  ySyncPluginKey
} from "@tiptap/y-tiptap";
import { compareRelativePositions, createRelativePositionFromJSON } from "yjs";

// Keep the standard Yjs cursor decorations, but also recognize focus in an embedded editor.
const withEmbeddedCursorView = (
  plugin: Plugin<DecorationSet>,
  awareness: NonNullable<HocuspocusProvider["awareness"]>
): Plugin<DecorationSet> =>
  new Plugin({
    ...plugin.spec,
    view(view) {
      let destroyed = false;
      let scheduled = false;

      const updateCursor = (force = false) => {
        const sync = ySyncPluginKey.getState(view.state);
        const current = awareness.getLocalState()?.cursor;
        const active = view.dom.ownerDocument.activeElement;
        const embeddedFocus =
          active instanceof Element &&
          active.closest("[data-code-block]") &&
          view.dom.contains(active);

        if (destroyed || !sync?.binding?.mapping) return;

        if (view.hasFocus() || embeddedFocus) {
          const selection = view.state.selection;
          const anchor = absolutePositionToRelativePosition(
            selection.anchor,
            sync.type,
            sync.binding.mapping
          );
          const head = absolutePositionToRelativePosition(
            selection.head,
            sync.type,
            sync.binding.mapping
          );

          if (
            force ||
            !current ||
            !compareRelativePositions(createRelativePositionFromJSON(current.anchor), anchor) ||
            !compareRelativePositions(createRelativePositionFromJSON(current.head), head)
          ) {
            awareness.setLocalStateField("cursor", { anchor, head });
          }
        } else if (
          current &&
          relativePositionToAbsolutePosition(
            sync.doc,
            sync.type,
            createRelativePositionFromJSON(current.anchor),
            sync.binding.mapping
          ) !== null
        ) {
          awareness.setLocalStateField("cursor", null);
        }
      };
      const awarenessChanged = () => {
        if (destroyed || scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          if (!destroyed)
            view.dispatch(view.state.tr.setMeta(yCursorPluginKey, { awarenessUpdated: true }));
        });
      };
      const focusChanged = () => queueMicrotask(() => updateCursor());

      awareness.on("change", awarenessChanged);
      view.dom.addEventListener("focusin", focusChanged);
      view.dom.addEventListener("focusout", focusChanged);
      return {
        update(view, previous) {
          const sync = ySyncPluginKey.getState(view.state);
          updateCursor(Boolean(sync?.isChangeOrigin && !previous.doc.eq(view.state.doc)));
        },
        destroy() {
          destroyed = true;
          awareness.off("change", awarenessChanged);
          view.dom.removeEventListener("focusin", focusChanged);
          view.dom.removeEventListener("focusout", focusChanged);
          awareness.setLocalStateField("cursor", null);
        }
      };
    }
  });

export { withEmbeddedCursorView };
