import type { Editor } from "@tiptap/core";
import { type Accessor, createEffect, on, untrack } from "solid-js";
import type {
  EditorCommentPlace,
  EditorCommentsPanel,
  EditorCommentThread,
  ElementViews
} from "#editor/client-types";
import { listOptions, textOptions } from "#editor/ui/menus/block-menu/turn-into";
import { getBlocks } from "#editor/extensions/comments";
import { getEditorScrollContainer } from "#editor/ui/block-control-targeting";
import type { CommentLayout } from "./layout";

interface CommentsPanelSync {
  editor: Editor;
  panel: Accessor<EditorCommentsPanel | undefined>;
  layout: Accessor<CommentLayout | null>;
  /** With resolved ones, which have no highlights. */
  threads: Accessor<EditorCommentThread[]>;
  elementViews?: ElementViews;
}

type CommentBlock = NonNullable<EditorCommentPlace["block"]>;

const VIEW_MARGIN = 64;
// Blocks "Turn into" doesn't offer.
const OTHER_BLOCKS: Record<string, CommentBlock> = {
  image: { label: "Image", icon: "i-lucide:image" },
  table: { label: "Table", icon: "i-lucide:table" },
  horizontalRule: { label: "Divider", icon: "i-lucide:minus" },
  // Child blocks, which suggestions can target.
  listItem: { label: "List item", icon: "i-lucide:list" },
  taskItem: { label: "Task", icon: "i-lucide:list-checks" },
  tableRow: { label: "Table row", icon: "i-lucide:rows-3" },
  tableCell: { label: "Table cell", icon: "i-lucide:table" },
  tableHeader: { label: "Table cell", icon: "i-lucide:table" }
};

const describeBlock = (
  name: string,
  attrs: Record<string, unknown> = {},
  elementViews?: ElementViews
): CommentBlock => {
  const option = [...textOptions, ...listOptions].find((current) => {
    return current.name === name && (!current.level || current.level === attrs.level);
  });

  if (name === "element") {
    const element = String(attrs.name);
    const view = elementViews?.list().find((current) => current.element === element);

    return { label: view?.label ?? element, icon: view?.icon ?? "i-lucide:code-xml" };
  }

  return option ?? OTHER_BLOCKS[name] ?? { label: "Block", icon: "i-lucide:square" };
};

const scrollToThread = (editor: Editor, layout: CommentLayout | null, threadID: string | null) => {
  const anchor = layout?.anchors.find(({ thread }) => thread.id === threadID);
  const container = getEditorScrollContainer(editor);

  if (!anchor || !container) return;

  const top = container.scrollTop + VIEW_MARGIN;
  const bottom = container.scrollTop + container.clientHeight - VIEW_MARGIN;

  if (anchor.center > top && anchor.center < bottom) return;

  container.scrollTo({ top: anchor.center - container.clientHeight / 3, behavior: "smooth" });
};
const syncCommentsPanel = (options: CommentsPanelSync): void => {
  // Resolved block threads go last.
  const places = (): EditorCommentPlace[] => {
    const blocks = getBlocks(options.editor.state.doc);
    const highlighted = (options.layout()?.anchors ?? []).map(({ thread, block }) => ({
      thread,
      block
    }));
    const resolved = options
      .threads()
      .flatMap((thread) => {
        const found = thread.resolved && thread.blockID ? blocks.get(thread.blockID) : null;

        return found ? [{ thread, block: found.node, pos: found.pos }] : [];
      })
      .sort((a, b) => a.pos - b.pos);

    return [...highlighted, ...resolved].map(({ thread, block }) => {
      return {
        threadID: thread.id,
        block: block && describeBlock(block.type.name, block.attrs, options.elementViews)
      };
    });
  };
  // As text, so the panel updates only on real changes.
  const key = () => {
    if (!options.panel()) return "";

    return JSON.stringify(places().map(({ threadID, block }) => [threadID, block?.label]));
  };

  createEffect(on(key, () => options.panel()?.setOrder(untrack(places))));
  createEffect(
    on(
      () => options.panel()?.active ?? null,
      (active) => scrollToThread(options.editor, untrack(options.layout), active),
      { defer: true }
    )
  );
};

export { describeBlock, scrollToThread, syncCommentsPanel };
