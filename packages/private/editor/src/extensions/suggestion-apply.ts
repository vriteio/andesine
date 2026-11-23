import { type Editor, Extension } from "@tiptap/core";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import type { UndoManager } from "yjs";
import { rebaseSuggestion } from "#editor/lib/suggestion-status";
import { replaceSuggestion } from "#editor/lib/suggestion-apply";
import { commentsPluginKey } from "./comments";

interface SuggestionApplyOptions {
  /** Marks the thread only; the editor makes the change. */
  setApplied(threadID: string, applied: boolean): Promise<unknown>;
}
interface SuggestionApplyStorage {
  setApplied: SuggestionApplyOptions["setApplied"];
}
interface StackItemEvent {
  stackItem: { meta: Map<string, unknown> };
  type: "undo" | "redo";
}

declare module "@tiptap/core" {
  interface Storage {
    suggestionApply: SuggestionApplyStorage;
  }
}

// Undo-step meta key for the applied thread.
const APPLIED_THREAD_KEY = "appliedSuggestion";
const CHANGED_MESSAGE = "The content changed since the suggestion was saved";

const getUndoManager = (editor: Editor): UndoManager | undefined => {
  return yUndoPluginKey.getState(editor.state)?.undoManager;
};
const getActiveSuggestion = (editor: Editor, threadID: string) => {
  const thread = commentsPluginKey
    .getState(editor.state)
    ?.threads.find(({ id }) => id === threadID);
  const suggestion = thread?.suggestion;

  return suggestion ? rebaseSuggestion(editor.state.doc, suggestion) : null;
};
/** Marks the thread first, so only one concurrent apply wins. */
const applySuggestion = async (editor: Editor, threadID: string) => {
  const { setApplied } = editor.storage.suggestionApply;

  if (!getActiveSuggestion(editor, threadID)) throw new Error(CHANGED_MESSAGE);

  await setApplied(threadID, true);

  const suggestion = editor.isDestroyed ? null : getActiveSuggestion(editor, threadID);
  const manager = getUndoManager(editor);
  const tr = editor.state.tr;
  const isReplaced = suggestion && replaceSuggestion(tr, suggestion);

  if (!isReplaced) {
    await setApplied(threadID, false);
    throw new Error(CHANGED_MESSAGE);
  }

  const size = manager?.undoStack.length ?? 0;

  // Its own undo step, to tag with the thread.
  manager?.stopCapturing();
  editor.view.dispatch(tr);

  // Only a step it added, as a change without one would tag the user's last edit.
  if (manager && manager.undoStack.length > size) {
    manager.undoStack.at(-1)?.meta.set(APPLIED_THREAD_KEY, threadID);
  }

  manager?.stopCapturing();
};

const SuggestionApply = Extension.create<SuggestionApplyOptions, SuggestionApplyStorage>({
  name: "suggestionApply",
  addOptions() {
    return { setApplied: () => Promise.resolve() };
  },
  addStorage() {
    return { setApplied: this.options.setApplied };
  },
  onCreate() {
    const { editor, options } = this;
    const manager = getUndoManager(editor);
    const sync = ({ stackItem, type }: StackItemEvent) => {
      const threadID = stackItem.meta.get(APPLIED_THREAD_KEY);
      const destination = type === "undo" ? manager?.redoStack : manager?.undoStack;

      if (typeof threadID !== "string") return;

      // The reverse step, which the undo manager added before this event.
      destination?.at(-1)?.meta.set(APPLIED_THREAD_KEY, threadID);
      // Failures are ignored; the content follows the history.
      void options.setApplied(threadID, type === "redo").catch(() => undefined);
    };

    manager?.on("stack-item-popped", sync);
    editor.on("destroy", () => manager?.off("stack-item-popped", sync));
  }
});

export { applySuggestion, SuggestionApply };
