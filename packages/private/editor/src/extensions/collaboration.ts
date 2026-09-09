import {
  Collaboration as BaseCollaboration,
  type CollaborationOptions as BaseCollaborationOptions
} from "@tiptap/extension-collaboration";
import type { Command } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { ySyncPluginKey, yUndoPluginKey } from "@tiptap/y-tiptap";
import type { UndoManager } from "yjs";
import { changesImages } from "#editor/lib/image-counts";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { createSignal, type Accessor } from "solid-js";

interface CollaborationOptions extends BaseCollaborationOptions {
  awareness: HocuspocusProvider["awareness"];
  canChangeImages(): boolean;
}

declare module "@tiptap/extension-collaboration" {
  interface CollaborationStorage {
    imageUploads: Accessor<Set<string>>;
    refreshImageUploads(): void;
    setImageUploading(nodeID: string, uploading: boolean): void;
  }
}

const Collaboration = BaseCollaboration.extend<CollaborationOptions>({
  addOptions() {
    return { ...this.parent?.(), awareness: null, canChangeImages: () => false };
  },
  addStorage() {
    const [imageUploads, setImageUploads] = createSignal(new Set<string>());
    const localUploads = new Set<string>();

    return {
      ...this.parent!(),
      imageUploads,
      refreshImageUploads: () => {
        const awareness = this.options.awareness;
        const uploads = new Set<string>();

        awareness?.getStates().forEach((state, clientID) => {
          if (clientID === awareness.clientID || !Array.isArray(state.imageUploads)) return;
          for (const nodeID of state.imageUploads) {
            if (typeof nodeID === "string") uploads.add(nodeID);
          }
        });
        setImageUploads(uploads);
      },
      setImageUploading: (nodeID, uploading) => {
        if (uploading) localUploads.add(nodeID);
        else localUploads.delete(nodeID);
        this.options.awareness?.setLocalStateField("imageUploads", [...localUploads]);
      }
    };
  },
  addProseMirrorPlugins() {
    const awareness = this.options.awareness;
    const storage = this.storage;

    return [
      ...(this.parent?.() || []),
      new Plugin({
        view() {
          awareness?.on("change", storage.refreshImageUploads);
          storage.refreshImageUploads();

          return {
            destroy() {
              awareness?.off("change", storage.refreshImageUploads);
              awareness?.setLocalStateField("imageUploads", []);
            }
          };
        },
        filterTransaction(transaction, state) {
          if (
            transaction.docChanged &&
            !transaction.getMeta(ySyncPluginKey) &&
            changesImages(transaction.before, transaction.doc)
          ) {
            const manager: UndoManager | undefined = yUndoPluginKey.getState(state)?.undoManager;

            // Keep image changes separate from adjacent offline text edits in history.
            manager?.stopCapturing();
          }
          return true;
        }
      })
    ];
  },
  addCommands() {
    const parent = this.parent!();
    const options = this.options;
    const runHistory =
      (direction: "undo" | "redo"): Command =>
      (context) => {
        const manager: UndoManager = yUndoPluginKey.getState(context.state).undoManager;
        const stack = direction === "undo" ? manager.undoStack : manager.redoStack;
        const changesImage = stack.at(-1)?.meta.get("changesImage");

        if (changesImage && !options.canChangeImages()) return false;

        const result = parent[direction]!()(context);

        if (result && context.dispatch && changesImage) {
          const destination = direction === "undo" ? manager.redoStack : manager.undoStack;

          destination.at(-1)?.meta.set("changesImage", true);
        }
        return result;
      };

    return { ...parent, undo: () => runHistory("undo"), redo: () => runHistory("redo") };
  },
  onTransaction({ editor, transaction }) {
    if (
      !transaction.docChanged ||
      transaction.getMeta(ySyncPluginKey) ||
      !changesImages(transaction.before, transaction.doc)
    )
      return;

    const manager: UndoManager | undefined = yUndoPluginKey.getState(editor.state)?.undoManager;

    manager?.undoStack.at(-1)?.meta.set("changesImage", true);
    manager?.stopCapturing();
  }
});

export { Collaboration };
