import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { ChildPresentation } from "#editor/client-types";

interface PresentationState {
  /** The presentation of child blocks by the node ID of the element whose view sets it. */
  owners: Map<string, ChildPresentation>;
  decorations: DecorationSet;
}
interface PresentationMeta {
  owner: string;
  presentation: ChildPresentation;
}

const elementPresentationKey = new PluginKey<PresentationState>("elementPresentation");

const createDecorations = (doc: ProseMirrorNode, owners: Map<string, ChildPresentation>) => {
  const hidden = new Set([...owners.values()].flatMap((presentation) => presentation.hidden));
  const plain = new Set([...owners.values()].flatMap((presentation) => presentation.plain));
  const decorations: Decoration[] = [];

  if (!hidden.size && !plain.size) return DecorationSet.empty;

  doc.descendants((node, pos) => {
    const attrs = {
      ...(hidden.has(node.attrs.id) && { "data-element-hidden": "" }),
      ...(plain.has(node.attrs.id) && { "data-element-plain": "" })
    };

    if (Object.keys(attrs).length)
      decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
  });

  return DecorationSet.create(doc, decorations);
};
/** How element views present their child blocks, e.g. hide the other tabs; the editor draws them. */
const createElementPresentationPlugin = () => {
  return new Plugin<PresentationState>({
    key: elementPresentationKey,
    state: {
      init: () => ({ owners: new Map(), decorations: DecorationSet.empty }),
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(elementPresentationKey) as PresentationMeta | undefined;

        if (meta) {
          const owners = new Map(value.owners);
          const isEmpty = !meta.presentation.hidden.length && !meta.presentation.plain.length;

          if (isEmpty) owners.delete(meta.owner);
          else owners.set(meta.owner, meta.presentation);

          return { owners, decorations: createDecorations(state.doc, owners) };
        }

        // From the IDs: mapping drops node decorations when a block is replaced, e.g. by syncing.
        return tr.docChanged
          ? { ...value, decorations: createDecorations(state.doc, value.owners) }
          : value;
      }
    },
    props: {
      decorations: (state) => elementPresentationKey.getState(state)?.decorations
    }
  });
};

export { createElementPresentationPlugin, elementPresentationKey };
export type { PresentationMeta };
