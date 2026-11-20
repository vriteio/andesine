import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorCommentThread } from "#editor/client-types";
import { DRAFT_THREAD_ID, getCommentThreadPositions } from "#editor/extensions/comments";
import { getEditorScrollContainer } from "#editor/ui/block-control-targeting";
import { getBlockReach, getBlockScrollers } from "#editor/ui/block-scroll";
import { BLOCK_CONTROL_SIZE } from "#editor/ui/constants";
import { FIRST_COMMENT_CENTER, THREAD_CARD_WIDTH } from "./thread-card";

interface ThreadAnchor {
  thread: EditorCommentThread;
  /** In the scroll content. */
  center: number;
  /** In a scrollable block that reaches its card or button. */
  concealed: boolean;
  block?: ProseMirrorNode;
  /** Read again as blocks scroll. */
  getReach(): number;
}
interface BlockScroller {
  scroller: HTMLElement;
  range: VerticalRange;
}
interface VerticalRange {
  top: number;
  bottom: number;
}
interface AnchorGroup {
  key: string;
  center: number;
  threads: EditorCommentThread[];
  count: number;
}
interface ThreadPlacement {
  tops: Record<string, number>;
  /** All when the gutter is narrow, else groups whose cards don't fit. */
  buttons: AnchorGroup[];
}
interface CommentLayout {
  /** Cards in the gutter, else buttons. */
  inline: boolean;
  controlsLeft: number;
  anchors: ThreadAnchor[];
  /** How far a block may reach before it covers the cards or buttons. */
  reach: number;
  /** Their ranges don't change as they scroll. */
  scrollers: BlockScroller[];
  /** Scrollable blocks that reach the cards. */
  obstacles: VerticalRange[];
}

const GUTTER_SPACE = 8;
// Inline cards' padding (p-1), offset so their content stays in place.
const INLINE_INSET = 4;
const CARDS_OFFSET = 8 + BLOCK_CONTROL_SIZE + GUTTER_SPACE - INLINE_INSET;
const BLOCK_SPACE = 8;
// Closer anchors share a button, as theirs would overlap.
const GROUP_DISTANCE = BLOCK_CONTROL_SIZE + 2;
const CARD_GAP = 8;

const measureComments = (
  editor: Editor,
  threadsByID: Map<string, EditorCommentThread>
): CommentLayout | null => {
  const scrollContainer = getEditorScrollContainer(editor);

  if (!scrollContainer || editor.isDestroyed) return null;

  const containerRect = scrollContainer.getBoundingClientRect();
  const contentRect = editor.view.dom.getBoundingClientRect();
  const toY = (y: number) => y - containerRect.top + scrollContainer.scrollTop;
  const controlsLeft = contentRect.right - containerRect.left + scrollContainer.scrollLeft + 8;
  const gutter = containerRect.right - contentRect.right - 8 - BLOCK_CONTROL_SIZE;
  const inline = gutter >= THREAD_CARD_WIDTH + GUTTER_SPACE * 2;
  const anchors = getCommentThreadPositions(editor.state).flatMap(({ threadID, pos, block }) => {
    const thread = threadsByID.get(threadID);
    const dom = block ? editor.view.nodeDOM(pos) : null;
    const { node } = editor.view.domAtPos(pos);
    const element = node instanceof Element ? node : node.parentElement;
    const getReach = () => {
      if (dom instanceof HTMLElement) {
        return Math.max(getBlockReach(dom, true), getBlockReach(dom, false));
      }

      return element ? getBlockReach(element, false) : 0;
    };

    if (!thread) return [];

    if (dom instanceof HTMLElement) {
      const rect = dom.getBoundingClientRect();
      const node = editor.state.doc.nodeAt(pos) ?? undefined;
      const center = toY(rect.top + Math.min(rect.height, 32) / 2);

      return [{ thread, concealed: false, block: node, center, getReach }];
    }

    const coords = editor.view.coordsAtPos(pos, 1);

    return [{ thread, concealed: false, center: toY((coords.top + coords.bottom) / 2), getReach }];
  });
  const scrollers = getBlockScrollers(editor.view.dom).map((scroller) => {
    const rect = scroller.getBoundingClientRect();

    return { scroller, range: { top: toY(rect.top), bottom: toY(rect.bottom) } };
  });

  return refreshReach({
    inline,
    controlsLeft,
    anchors: anchors.sort((a, b) => a.center - b.center),
    reach: (inline ? CARDS_OFFSET : 8) - BLOCK_SPACE,
    scrollers,
    obstacles: []
  });
};
/** On block scroll, which changes only the reach; reads no sizes. */
const refreshReach = (layout: CommentLayout): CommentLayout => {
  const isReaching = (reach: number) => reach > layout.reach;
  const anchors = layout.anchors.map((anchor) => {
    const concealed = anchor.thread.id !== DRAFT_THREAD_ID && isReaching(anchor.getReach());

    return concealed === anchor.concealed ? anchor : { ...anchor, concealed };
  });
  const obstacles = layout.scrollers
    .filter(({ scroller }) => isReaching(getBlockReach(scroller, false)))
    .map(({ range }) => range);
  // Unchanged, so the threads aren't placed again.
  const isUnchanged =
    anchors.every((anchor, index) => anchor === layout.anchors[index]) &&
    obstacles.length === layout.obstacles.length &&
    obstacles.every((range, index) => range === layout.obstacles[index]);

  return isUnchanged ? layout : { ...layout, anchors, obstacles };
};

const groupAnchors = (anchors: ThreadAnchor[]): AnchorGroup[] => {
  const groups: AnchorGroup[] = [];

  for (const { thread, center, concealed } of anchors) {
    const previous = groups[groups.length - 1];

    if (concealed) continue;

    if (previous && center - previous.center < GROUP_DISTANCE) {
      previous.threads.push(thread);
      previous.count += thread.comments.length;
      continue;
    }

    groups.push({ key: thread.id, center, threads: [thread], count: thread.comments.length });
  }

  return groups;
};
/** Judged by closed heights, so an opened card doesn't turn into a button. */
const placeThreads = (
  layout: CommentLayout | null,
  heights: Record<string, number>,
  closedHeights: Record<string, number>
): ThreadPlacement => {
  const groups = groupAnchors(layout?.anchors ?? []);
  const placement: ThreadPlacement = { tops: {}, buttons: [] };

  let bottom = -Infinity;

  if (!layout?.inline) return { tops: {}, buttons: groups };

  for (const group of groups) {
    const tops: Record<string, number> = {};
    const first = Math.max(group.center - FIRST_COMMENT_CENTER, bottom + CARD_GAP);

    let top = first;
    let closedBottom = first;

    for (const { id } of group.threads) {
      tops[id] = top;
      closedBottom = top + (closedHeights[id] ?? heights[id] ?? 0);
      top += (heights[id] ?? 0) + CARD_GAP;
    }

    const coversBlock = layout.obstacles.some((range) => {
      return first < range.bottom + BLOCK_SPACE && closedBottom > range.top - BLOCK_SPACE;
    });

    if (coversBlock) {
      placement.buttons.push(group);
      continue;
    }

    Object.assign(placement.tops, tops);
    bottom = top - CARD_GAP;
  }

  return placement;
};

export { GUTTER_SPACE, INLINE_INSET, measureComments, placeThreads, refreshReach };
export type { AnchorGroup, CommentLayout };
