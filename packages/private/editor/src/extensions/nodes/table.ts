import { Table as BaseTable } from "@andesine/document/tiptap";
import { Plugin } from "@tiptap/pm/state";
import { normalizePastedCellContent, normalizePastedTables } from "./table-paste";

// The node view provides pointer-based column resize handles.
const Table = BaseTable.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPastedHTML: normalizePastedTables,
          transformPasted: normalizePastedCellContent
        }
      }),
      ...(this.parent?.() || [])
    ];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      mergeCells: () => () => false,
      splitCell: () => () => false,
      mergeOrSplit: () => () => false
    };
  }
}).configure({ View: null });

export { Table };
