import { countImages } from "#editor/lib/image-counts";
import { createBlockRangeSelection, isBlockSelection } from "./block-selection";
import { Extension } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin, NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { nanoid } from "nanoid";
import type { EditorImages } from "#editor/client-types";

interface ImageOptions {
  images(): EditorImages | undefined;
  notify?(type: "success" | "error", text: string): void;
}

const Images = Extension.create<ImageOptions>({
  name: "images",
  addOptions() {
    return { images: () => undefined };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    const controllers = new Set<AbortController>();
    const insert = (slice: Slice, files: File[], position?: number): boolean => {
      const assetIDs = new Set<string>();
      const images = options.images();

      slice.content.descendants((node) => {
        if (node.type.name === "image" && node.attrs.assetID) assetIDs.add(node.attrs.assetID);
      });
      if (!files.length && !assetIDs.size) return false;
      if (!images?.enabled() || !editor.isEditable) return true;

      if (files.length) {
        const uploads = new Map(files.map((file) => [nanoid(), file]));
        const transaction = editor.state.tr;

        const nodes = Array.from(uploads.keys(), (id) => editor.schema.nodes.image.create({ id }));

        if (position !== undefined) {
          transaction.insert(position, Fragment.fromArray(nodes));
        } else {
          transaction.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0));
        }

        if (position === undefined) transaction.scrollIntoView();

        editor.view.dispatch(transaction);
        editor.state.doc.descendants((node, pos) => {
          const file = uploads.get(node.attrs.id);
          const element =
            file &&
            (editor.view.nodeDOM(pos) as HTMLElement | null)?.querySelector("[data-image-block]");

          if (element) element.dispatchEvent(new CustomEvent("image-upload", { detail: file }));
        });
        return true;
      }

      const controller = new AbortController();

      let bookmark = (
        position === undefined
          ? editor.state.selection
          : TextSelection.near(editor.state.doc.resolve(position))
      ).getBookmark();

      const mapBookmark = ({ transaction }: { transaction: Transaction }) => {
        bookmark = bookmark.map(transaction.mapping);
      };

      controllers.add(controller);
      editor.on("transaction", mapBookmark);
      void (async () => {
        try {
          if (assetIDs.size) await images.attach([...assetIDs], controller.signal);
          if (
            controller.signal.aborted ||
            editor.isDestroyed ||
            !editor.isEditable ||
            !images.enabled()
          )
            return;

          const selection = bookmark.resolve(editor.state.doc);
          const transaction = editor.state.tr.setSelection(selection);

          transaction.replaceSelection(slice);
          if (position === undefined) transaction.scrollIntoView();
          editor.view.dispatch(transaction);
        } catch (error) {
          if (!controller.signal.aborted)
            options.notify?.(
              "error",
              error instanceof Error ? error.message : "Image insertion failed"
            );
        } finally {
          editor.off("transaction", mapBookmark);
          controllers.delete(controller);
        }
      })();
      return true;
    };

    return [
      new Plugin({
        filterTransaction(transaction, state) {
          if (
            !transaction.docChanged ||
            transaction.getMeta(ySyncPluginKey) ||
            options.images()?.enabled()
          )
            return true;

          const current = countImages(state.doc);
          const next = countImages(transaction.doc);

          return [...next].every(([id, count]) => count <= (current.get(id) || 0));
        },
        appendTransaction(_transactions, _oldState, state) {
          const { selection, doc } = state;
          const node = doc.nodeAt(selection.from);

          if (
            isBlockSelection(selection) ||
            !(selection instanceof TextSelection || selection instanceof NodeSelection) ||
            node?.type.name !== "image" ||
            selection.to !== selection.from + node.nodeSize
          )
            return null;

          // Focus and native DOM selection can turn an atomic image selection into
          // a text/node selection. Keep image actions and shading on block selection.
          return state.tr.setSelection(
            createBlockRangeSelection(doc, {
              from: selection.from,
              to: selection.to,
              depth: selection.$from.depth
            })
          );
        },
        props: {
          handlePaste(_view, event, slice) {
            const files = Array.from(event.clipboardData?.files || []).filter((file) =>
              file.type.startsWith("image/")
            );

            return insert(slice, files);
          },
          handleDrop(view, event, slice, moved) {
            if (moved) return false;

            const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
              file.type.startsWith("image/")
            );
            const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;

            if (files.length && position === undefined) return true;

            return insert(slice, files, position);
          }
        },
        view() {
          return {
            destroy() {
              for (const controller of controllers) controller.abort();
            }
          };
        }
      })
    ];
  }
});

export { Images };
