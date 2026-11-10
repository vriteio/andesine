/*
 * Cursor navigation is adapted from Curvenote's prosemirror-codemark.
 * Copyright (c) 2022 Curvenote Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type { MarkType, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { DecorationSet, type EditorView } from "@tiptap/pm/view";
import {
  BOUNDARY_CURSOR_ACTIVE_CLASS,
  createBoundaryCursor,
  createClickedSide,
  isRemoteChange
} from "#editor/extensions/boundary-cursor";

interface CodeMarkCursorPluginOptions {
  markType: MarkType;
  maxSelectedTextLength?: number;
}

type CodeCursorState = {
  active?: boolean;
  inside?: boolean;
  side?: -1 | 0;
  next?: true;
} | null;

type CodeCursorMeta = {
  action: "next";
};

const codeCursorPluginKey = new PluginKey<CodeCursorState>("codeMarkCursor");

const safeResolve = (doc: ProseMirrorNode, position: number) => {
  return doc.resolve(Math.min(Math.max(1, position), doc.nodeSize - 2));
};

const codeCursorState = (state: EditorState) => codeCursorPluginKey.getState(state);

/**
 * Mark the next transaction as one which should leave the code mark. The browser
 * still performs the actual cursor movement for keys such as Home and ArrowUp.
 */
const leaveCodeAfterNextTransaction = (view: EditorView) => {
  view.dispatch(
    view.state.tr.setMeta(codeCursorPluginKey, { action: "next" } satisfies CodeCursorMeta)
  );

  return false;
};

const removeCodeStoredMarkAtBoundary = (state: EditorState, markType: MarkType) => {
  const { selection, doc } = state;

  if (!selection.empty) return null;

  const storedCode = !!markType.isInSet(state.storedMarks || []);
  const codeBefore = !!markType.isInSet(selection.$from.marks());
  const codeAfter = !!markType.isInSet(safeResolve(doc, selection.from + 1).marks());
  const atStartOfTextblock = selection.$from.parentOffset === 0;

  if (
    codeBefore !== codeAfter ||
    (!codeBefore && storedCode !== codeBefore) ||
    (codeBefore && atStartOfTextblock)
  ) {
    return state.tr.removeStoredMark(markType);
  }

  return null;
};

/** Whether the caret is at a code's edge, a position with a side inside and outside the box. */
const isAtCodeBoundary = (state: EditorState, markType: MarkType) => {
  const { selection } = state;
  const codeBefore = !!markType.isInSet(selection.$from.nodeBefore?.marks ?? []);
  const codeAfter = !!markType.isInSet(selection.$from.nodeAfter?.marks ?? []);

  return selection.empty && codeBefore !== codeAfter;
};
/**
 * A click at a code boundary puts the caret on the side that was clicked: inside the code's box,
 * or outside it. Both sides are one position, so the stored mark decides.
 */
const setCodeStoredMarkAtBoundary = (state: EditorState, markType: MarkType, inside: boolean) => {
  if (!isAtCodeBoundary(state, markType)) return null;

  return inside ? state.tr.addStoredMark(markType.create()) : state.tr.removeStoredMark(markType);
};

const handleBacktick = (
  view: EditorView,
  event: KeyboardEvent,
  markType: MarkType,
  maxSelectedTextLength: number
) => {
  const { selection } = view.state;

  if (
    selection.empty ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    event.ctrlKey ||
    selection.to - selection.from >= maxSelectedTextLength ||
    view.state.doc.rangeHasMark(selection.from, selection.to, markType)
  ) {
    return false;
  }

  const transaction = view.state.tr.addMark(selection.from, selection.to, markType.create());

  view.dispatch(
    transaction
      .setSelection(TextSelection.create(transaction.doc, selection.to))
      .removeStoredMark(markType)
  );

  return true;
};

const handleArrowRightInside = (view: EditorView, event: KeyboardEvent, markType: MarkType) => {
  if (event.metaKey) return leaveCodeAfterNextTransaction(view);
  if (event.shiftKey || event.altKey || event.ctrlKey) return false;

  const { selection, doc } = view.state;

  if (!selection.empty) return false;

  const cursor = codeCursorState(view.state);
  const position = selection.$from;
  const codeBefore = !!markType.isInSet(position.marks());
  const codeAfter = !!markType.isInSet(safeResolve(doc, selection.from + 1).marks());

  if (
    position.pos === doc.nodeSize - 3 &&
    position.parentOffset === position.parent.nodeSize - 2 &&
    cursor?.active
  ) {
    view.dispatch(view.state.tr.removeStoredMark(markType));
    return true;
  }

  if (codeBefore === codeAfter && position.parentOffset !== 0) return false;

  if (codeBefore && (!cursor?.active || cursor.side === -1) && position.parentOffset !== 0) {
    // `code|` -> `code`|
    view.dispatch(view.state.tr.removeStoredMark(markType));
    return true;
  }

  if (codeAfter && cursor?.active && cursor.side === -1) {
    // |`code` -> `|code`
    view.dispatch(view.state.tr.addStoredMark(markType.create()));
    return true;
  }

  return false;
};

const handleArrowRight = (view: EditorView, event: KeyboardEvent, markType: MarkType) => {
  if (handleArrowRightInside(view, event, markType)) return true;

  const { selection } = view.state;
  const position = selection.$from;

  if (selection.empty && position.parentOffset === position.parent.nodeSize - 2) {
    return leaveCodeAfterNextTransaction(view);
  }

  return false;
};

const handleArrowLeftInside = (view: EditorView, event: KeyboardEvent, markType: MarkType) => {
  if (event.metaKey) return leaveCodeAfterNextTransaction(view);
  if (event.shiftKey || event.altKey || event.ctrlKey) return false;

  const { selection, doc } = view.state;
  const cursor = codeCursorState(view.state);
  const codeBefore = !!markType.isInSet(selection.$from.marks());
  const codeToLeft = !!markType.isInSet(
    safeResolve(doc, selection.empty ? selection.from - 1 : selection.from + 1).marks()
  );

  if (codeBefore && cursor?.active && cursor.side === -1 && selection.$from.parentOffset === 0) {
    return false;
  }

  if (cursor?.active && cursor.side === 0 && selection.$from.parentOffset === 0) {
    view.dispatch(view.state.tr.removeStoredMark(markType));
    return true;
  }

  if (codeBefore && codeToLeft && cursor?.active && cursor.side === 0) {
    // `code`| -> `code|`
    view.dispatch(view.state.tr.addStoredMark(markType.create()));
    return true;
  }

  if (codeBefore && !codeToLeft && cursor?.active && selection.$from.parentOffset === 0) {
    view.dispatch(view.state.tr.removeStoredMark(markType));
    return true;
  }

  if (!codeBefore && cursor?.active && cursor.side === 0) {
    // `|code` -> |`code`
    view.dispatch(view.state.tr.removeStoredMark(markType));
    return true;
  }

  if (codeBefore === codeToLeft) return false;

  if (codeToLeft || (!selection.empty && codeBefore)) {
    const from = selection.empty ? selection.from - 1 : selection.from;
    const transaction = view.state.tr.setSelection(TextSelection.create(doc, from));

    view.dispatch(
      !selection.empty && codeToLeft
        ? transaction.addStoredMark(markType.create())
        : transaction.removeStoredMark(markType)
    );
    return true;
  }

  if (codeBefore && !cursor?.active && selection.$from.parentOffset > 0) {
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(doc, selection.from - 1))
        .addStoredMark(markType.create())
    );
    return true;
  }

  if (codeBefore && !codeToLeft && cursor?.active && cursor.side !== -1) {
    view.dispatch(view.state.tr.addStoredMark(markType.create()));
    return true;
  }

  if (codeBefore && !codeToLeft && cursor?.active) {
    const position = selection.from - 1;

    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(doc, position))
        .addStoredMark(markType.create())
    );
    return true;
  }

  return false;
};

const handleArrowLeft = (view: EditorView, event: KeyboardEvent, markType: MarkType) => {
  if (handleArrowLeftInside(view, event, markType)) return true;

  const { selection } = view.state;
  const position = selection.$from;
  const cursor = codeCursorState(view.state);

  if (position.pos === 1 && position.parentOffset === 0 && cursor?.active && cursor.side === -1) {
    return true;
  }

  if (selection.empty && position.parentOffset === 0) {
    return leaveCodeAfterNextTransaction(view);
  }

  return false;
};

const handleBackspace = (view: EditorView, event: KeyboardEvent, markType: MarkType) => {
  if (event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) return false;

  const { selection, doc } = view.state;
  const from = safeResolve(doc, selection.from - 1);
  const codeBefore = !!markType.isInSet(from.marks());
  const atStartOfTextblock = from.parentOffset === 0;
  const codeAfter = !!markType.isInSet(safeResolve(doc, selection.to + 1).marks());

  if ((!codeBefore || atStartOfTextblock) && !codeAfter) {
    return leaveCodeAfterNextTransaction(view);
  }

  // Firefox can delete the boundary widget instead of the preceding character.
  const cursor = codeCursorState(view.state);

  if (selection.empty && cursor?.active && cursor.side === -1) {
    view.dispatch(view.state.tr.delete(selection.from - 1, selection.from));
    return true;
  }

  return false;
};

const handleDelete = (view: EditorView, event: KeyboardEvent, markType: MarkType) => {
  if (event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) return false;

  const { selection, doc } = view.state;
  const codeBefore = !!markType.isInSet(selection.$from.marks());
  const atStartOfTextblock = selection.$from.parentOffset === 0;
  const codeAfter = !!markType.isInSet(safeResolve(doc, selection.to + 2).marks());

  if ((!codeBefore || atStartOfTextblock) && !codeAfter) {
    return leaveCodeAfterNextTransaction(view);
  }

  return false;
};

const createCodeMarkCursorPlugin = ({
  markType,
  maxSelectedTextLength = 100
}: CodeMarkCursorPluginOptions) => {
  // A click inside a code's box puts the caret inside it at its edges, others outside.
  const clickedSide = createClickedSide({
    isInside: (target) => Boolean(target.closest("code")),
    setSide: (view, inside) => {
      const transaction = setCodeStoredMarkAtBoundary(view.state, markType, inside);

      if (transaction) view.dispatch(transaction);
    }
  });

  return new Plugin<CodeCursorState>({
    key: codeCursorPluginKey,
    appendTransaction: (transactions, oldState, newState) => {
      const previous = codeCursorPluginKey.getState(oldState);
      const clicked = clickedSide.get(transactions);
      // A remote change clears the stored marks, which hold the caret's side at a boundary.
      const isSideCleared =
        transactions.some(isRemoteChange) &&
        oldState.storedMarks &&
        !newState.storedMarks &&
        isAtCodeBoundary(newState, markType);

      if (clicked !== null) return setCodeStoredMarkAtBoundary(newState, markType, clicked);
      if (isSideCleared) return newState.tr.setStoredMarks(oldState.storedMarks);
      if (previous?.next) return removeCodeStoredMarkAtBoundary(newState, markType);

      return null;
    },
    state: {
      init: () => null,
      apply: (transaction, _previous, _oldState, state) => {
        const meta = transaction.getMeta(codeCursorPluginKey) as CodeCursorMeta | undefined;

        if (meta?.action === "next") return { next: true };
        if (!transaction.selection.empty) return null;

        const { selection } = transaction;
        const nextMark = markType.isInSet(
          state.storedMarks || state.doc.resolve(selection.from).marks()
        );
        const codeBefore = markType.isInSet(state.doc.resolve(selection.from).marks());
        const codeAfter = markType.isInSet(safeResolve(state.doc, selection.from + 1).marks());
        const atStartOfTextblock = selection.$from.parentOffset === 0;

        if (!nextMark && codeAfter && (!codeBefore || atStartOfTextblock)) {
          return { active: true, inside: false, side: -1 };
        }
        if (nextMark && (!codeBefore || atStartOfTextblock)) {
          return { active: true, inside: true, side: 0 };
        }
        if (!nextMark && codeBefore && !codeAfter) {
          return { active: true, inside: false, side: 0 };
        }
        if (nextMark && codeBefore && !codeAfter) {
          return { active: true, inside: true, side: -1 };
        }

        return null;
      }
    },
    props: {
      attributes: (state): Record<string, string> => {
        return codeCursorPluginKey.getState(state)?.active
          ? { class: BOUNDARY_CURSOR_ACTIVE_CLASS }
          : {};
      },
      decorations: (state) => {
        const cursor = codeCursorPluginKey.getState(state);

        if (!cursor?.active) return DecorationSet.empty;

        return DecorationSet.create(state.doc, [
          createBoundaryCursor(state.selection.from, cursor.side ?? 0, Boolean(cursor.inside))
        ]);
      },
      handleKeyDown: (view, event) => {
        switch (event.key) {
          case "`":
            return handleBacktick(view, event, markType, maxSelectedTextLength);
          case "ArrowRight":
            return handleArrowRight(view, event, markType);
          case "ArrowLeft":
            return handleArrowLeft(view, event, markType);
          case "Backspace":
            return handleBackspace(view, event, markType);
          case "Delete":
            return handleDelete(view, event, markType);
          case "ArrowUp":
          case "ArrowDown":
          case "Home":
          case "End":
            return leaveCodeAfterNextTransaction(view);
          case "a":
          case "e":
            return event.ctrlKey ? leaveCodeAfterNextTransaction(view) : false;
          default:
            return false;
        }
      },
      handleDOMEvents: { mousedown: clickedSide.mousedown }
    }
  });
};

export { createCodeMarkCursorPlugin };

export type { CodeMarkCursorPluginOptions };
