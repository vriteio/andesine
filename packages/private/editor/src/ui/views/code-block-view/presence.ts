import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Editor } from "@tiptap/core";
import { relativePositionToAbsolutePosition, ySyncPluginKey } from "@tiptap/y-tiptap";
import { createRelativePositionFromJSON } from "yjs";
import { Decoration, WidgetType } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import { createCaret, getCollaborationColor } from "../../../extensions/collaboration-caret";

class CodeCaret extends WidgetType {
  constructor(
    readonly clientID: number,
    readonly name: string,
    readonly color: string
  ) {
    super();
  }
  eq(other: CodeCaret): boolean {
    return (
      this.clientID === other.clientID && this.name === other.name && this.color === other.color
    );
  }
  toDOM(): HTMLElement {
    return createCaret({ name: this.name, color: this.color }, this.clientID);
  }
}

const getCodePresence = (
  editor: Editor,
  awareness: HocuspocusProvider["awareness"],
  start: number,
  length: number
): Array<Range<Decoration>> => {
  const sync = ySyncPluginKey.getState(editor.state);
  const ranges: Array<Range<Decoration>> = [];

  if (!sync?.binding?.mapping) return ranges;

  awareness?.getStates().forEach((state, clientID) => {
    if (clientID === awareness.clientID || state.collaborationSelection || !state.cursor) return;

    try {
      const anchor = relativePositionToAbsolutePosition(
        sync.doc,
        sync.type,
        createRelativePositionFromJSON(state.cursor.anchor),
        sync.binding.mapping
      );
      const head = relativePositionToAbsolutePosition(
        sync.doc,
        sync.type,
        createRelativePositionFromJSON(state.cursor.head),
        sync.binding.mapping
      );

      if (anchor === null || head === null) return;

      const color = getCollaborationColor(state.user?.color);
      const from = Math.max(0, Math.min(anchor, head) - start);
      const to = Math.min(length, Math.max(anchor, head) - start);

      if (from < to) {
        ranges.push(
          Decoration.mark({
            class: "collaboration-selection",
            attributes: { style: `--collaboration-color: ${color}` }
          }).range(from, to)
        );
      }
      if (head >= start && head <= start + length) {
        ranges.push(
          Decoration.widget({
            widget: new CodeCaret(clientID, state.user?.name || "Anonymous", color),
            side: 1
          }).range(head - start)
        );
      }
    } catch {
      // Ignore incomplete awareness data while a peer connects.
    }
  });
  return ranges;
};

export { getCodePresence };
