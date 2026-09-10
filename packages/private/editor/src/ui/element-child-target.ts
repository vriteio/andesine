import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  getCachedElementRect,
  getElementContentRect,
  type BlockControlTarget
} from "./block-control-sizing";

interface ElementChildTarget {
  content: HTMLElement;
  doc: ProseMirrorNode;
  target: BlockControlTarget;
}

const createElementChildTargetResolver = (editor: Editor) => {
  let lastTarget: ElementChildTarget | null = null;

  const getTarget = (dom: HTMLElement): BlockControlTarget | null => {
    const position = editor.view.posAtDOM(dom, 0);
    const $position = editor.state.doc.resolve(position);

    for (const pos of [
      position,
      ...Array.from({ length: $position.depth }, (_, index) =>
        $position.before($position.depth - index)
      )
    ]) {
      const node = editor.state.doc.nodeAt(pos);

      if (node && editor.view.nodeDOM(pos) === dom) return { dom, node, pos };
    }
    return null;
  };
  const resolve = (candidate: BlockControlTarget | null, y: number): BlockControlTarget | null => {
    const { doc } = editor.state;
    const contents = Array.from(
      editor.view.dom.querySelectorAll<HTMLElement>("[data-element-content]")
    ).filter((content) => {
      const rect = getElementContentRect(editor, content);

      return !content.hidden && rect.height > 0 && y >= rect.top && y < rect.bottom;
    });
    const content = contents.find(
      (item) => !contents.some((other) => item !== other && item.contains(other))
    );

    if (!content) {
      lastTarget = null;
      return candidate;
    }
    if (candidate && content.contains(candidate.dom)) {
      const rect = getCachedElementRect(editor, candidate.dom);

      if (y >= rect.top && y < rect.bottom) {
        lastTarget = { content, doc, target: candidate };
        return candidate;
      }
    }
    if (
      lastTarget?.content === content &&
      lastTarget.doc === doc &&
      content.contains(lastTarget.target.dom)
    ) {
      return lastTarget.target;
    }

    const distance = (dom: HTMLElement) => {
      const rect = getCachedElementRect(editor, dom);

      return Math.max(rect.top - y, y - rect.bottom, 0);
    };
    const nearest = Array.from(content.children)
      .filter((dom): dom is HTMLElement => dom instanceof HTMLElement)
      .map(getTarget)
      .filter((target): target is BlockControlTarget => Boolean(target))
      .reduce<BlockControlTarget | null>((previous, target) => {
        return !previous || distance(target.dom) < distance(previous.dom) ? target : previous;
      }, null);

    lastTarget = nearest ? { content, doc, target: nearest } : null;
    return nearest || candidate;
  };

  return resolve;
};

export { createElementChildTargetResolver };
