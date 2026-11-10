import { Plugin, PluginKey } from "@tiptap/pm/state";

interface DropTargetState {
  /** The range of the blocks that the editor drags, e.g. a card. */
  dragged: { from: number; to: number } | null;
  /** The block that a drop goes to, e.g. the card whose place the dragged one takes. */
  target: number | null;
}

const EMPTY_DROP_TARGET: DropTargetState = { dragged: null, target: null };
const dropTargetPluginKey = new PluginKey<DropTargetState>("dropTarget");

/** The editor's drag, for element views, e.g. to fade the dragged card and mark the target. */
const createDropTargetPlugin = () => {
  return new Plugin<DropTargetState>({
    key: dropTargetPluginKey,
    state: {
      init: () => EMPTY_DROP_TARGET,
      apply(transaction, value) {
        const meta = transaction.getMeta(dropTargetPluginKey) as
          Partial<DropTargetState> | undefined;
        const { mapping } = transaction;

        if (meta) return { ...value, ...meta };
        if (!transaction.docChanged) return value;

        const target = value.target === null ? null : mapping.mapResult(value.target);

        return {
          dragged: value.dragged && {
            from: mapping.map(value.dragged.from, 1),
            to: mapping.map(value.dragged.to, -1)
          },
          target: target && !target.deleted ? target.pos : null
        };
      }
    }
  });
};

export { createDropTargetPlugin, dropTargetPluginKey, EMPTY_DROP_TARGET };
export type { DropTargetState };
