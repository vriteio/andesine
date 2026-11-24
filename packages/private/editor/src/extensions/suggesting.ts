import {
  Decoration,
  type Editor,
  Extension,
  InlineDecoration,
  type JSONContent,
  NodeDecoration
} from "@tiptap/core";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";
import { ySyncPluginKey, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import type {
  EditorOwnSuggestion,
  EditorSuggesting,
  EditorSuggestionPatch
} from "#editor/client-types";
import { diffBlocks, diffPair, type SuggestionMark } from "#editor/lib/suggestion-diff";
import { getBlockID } from "#editor/lib/suggestion-ranges";
import {
  getSuggestionPatches,
  getUnits,
  isRejectedSave,
  isSamePatch,
  loadOwnSuggestions,
  overlaps,
  toPatch,
  type SuggestionDocuments
} from "#editor/lib/suggestion-patches";
import {
  drawSuggestedComments,
  getThreadAttributes,
  hashContent,
  getChangeAttributes,
  getChipAttributes,
  renderSuggestionText
} from "#editor/lib/suggestion-render";
import type { WidgetComponentProps } from "#editor/lib/create-widget-renderer";
import type { Component } from "solid-js";
import { getBlocks } from "./comments";
import { createBlockWidget, type SuggestedBlockProps } from "./suggestion-preview";

interface SuggestingOptions {
  fork: SuggestionFork | null;
  suggesting(): EditorSuggesting | undefined;
  restart(): void;
  owner: unknown;
  /** Draws a removed block with its node views. */
  renderBlock: Component<SuggestedBlockProps & WidgetComponentProps> | null;
}
interface SuggestingStorage {
  /** Saved patches by thread ID, in the fork's JSON. */
  known: Map<string, EditorSuggestionPatch>;
  restart(): void;
  /** Set during the load, so it isn't saved as an edit. */
  loading: boolean;
  /** Saves in flight, for the unload warning. */
  pending: number;
  /** The last host, for the save as the mode closes. */
  host?: EditorSuggesting;
  fork: SuggestionFork | null;
  requestSave?(): void;
}
interface SuggestionFork {
  main: Doc;
  document: Doc;
  /** Cached until the main document changes. */
  getMain(schema: Schema): JSONContent;
  getMainDoc(schema: Schema): ProseMirrorNode;
  destroy(): void;
}

declare module "@tiptap/core" {
  interface Storage {
    suggesting: SuggestingStorage;
  }
}

const MAIN_ORIGIN = Symbol("main");
const SAVE_DELAY = 1500;
const RETRY_DELAY = 5000;

// One save at a time per document, across restarted forks too.
const savingByMain = new WeakMap<Doc, Promise<boolean>>();

const createSuggestionFork = (main: Doc): SuggestionFork => {
  const document = new Doc();
  const forward = (update: Uint8Array) => {
    // Before the fork applies it, as that redraws the differences.
    mainDoc = null;
    mainJSON = null;
    applyUpdate(document, update, MAIN_ORIGIN);
  };
  const getMainDoc = (schema: Schema) => {
    return (mainDoc ??= yXmlFragmentToProseMirrorRootNode(main.getXmlFragment("default"), schema));
  };

  let mainDoc: ProseMirrorNode | null = null;
  let mainJSON: JSONContent | null = null;

  applyUpdate(document, encodeStateAsUpdate(main), MAIN_ORIGIN);
  main.on("update", forward);

  return {
    main,
    document,
    getMain: (schema) => (mainJSON ??= getMainDoc(schema).toJSON()),
    getMainDoc,
    destroy: () => {
      main.off("update", forward);
      document.destroy();
    }
  };
};
const createForkDecorations = (
  editor: Editor,
  doc: ProseMirrorNode,
  marks: SuggestionMark[],
  options: Pick<SuggestingOptions, "owner" | "renderBlock">,
  // Thread IDs of removed blocks, by block ID.
  threadIDs: Record<string, string> = {}
) => {
  const { schema } = doc.type;

  return marks.flatMap((mark, index): Decoration[] => {
    const key = "at" in mark ? `suggestion-removed:${mark.at}:${hashContent(mark.node)}` : "";

    // Drawn by the code editor, which reads the changes from the decoration.
    if (mark.type === "code") {
      return [Decoration.Node(mark.from, mark.to, {}, { codeDiff: mark.changes })];
    }

    if (mark.type === "attributes") {
      const attributes = { class: "suggestion-attributes", ...getChipAttributes(mark.changes) };

      return [Decoration.Node(mark.from, mark.to, attributes)];
    }

    if ("from" in mark) {
      const node = doc.nodeAt(mark.from);
      // Saves skip new empty paragraphs, e.g. the trailing node.
      const isEmptyParagraph = node?.type.name === "paragraph" && !node.content.size;
      const className = mark.type === "text" ? "suggestion-added" : "suggestion-added-block";
      const attributes = { class: className, ...getChangeAttributes(className) };

      if (isEmptyParagraph) return [];

      return mark.type === "text"
        ? [Decoration.Inline(mark.from, mark.to, attributes)]
        : [Decoration.Node(mark.from, mark.to, attributes)];
    }

    if (mark.type === "text") {
      const node = schema.nodeFromJSON(mark.node);
      const render = () => renderSuggestionText(schema, node, "suggestion-removed");

      return [Decoration.Widget(mark.at, render, { key, side: -1 })];
    }

    // Changed blocks show only their suggested version.
    if (mark.change !== "removed") return [];

    return [
      createBlockWidget(mark.at, mark.node, {
        editor,
        owner: options.owner,
        renderBlock: options.renderBlock,
        key,
        // Before the block at its position, in order.
        side: -1000 + index,
        className: "suggestion-removed-block",
        threadID: threadIDs[getBlockID(mark.node) ?? ""]
      })
    ];
  });
};
const drawSuggestedBlock = (
  editor: Editor,
  { base, changes = {}, comments = [] }: Omit<SuggestedBlockProps, "block">
) => {
  const decorations = new Plugin({
    props: {
      decorations: ({ doc }) => {
        const shown = doc.content.content.slice(1).map((node) => node.toJSON());
        const marks = base ? diffBlocks(doc, doc.firstChild!.nodeSize, shown, [base], true) : [];
        const blocks = getBlocks(doc);
        const changed = Object.entries(changes).flatMap(([blockID, threadID]) => {
          const block = blocks.get(blockID);

          return block ? [{ from: block.pos, to: block.pos + block.node.nodeSize, threadID }] : [];
        });
        const options = { owner: null, renderBlock: null };
        const diff = createForkDecorations(editor, doc, marks, options, changes).map(
          (decoration) => {
            const threadID = changed.find(({ from, to }) => {
              return from <= decoration.anchor && decoration.anchor < to;
            })?.threadID;
            const hasAttributes =
              decoration instanceof InlineDecoration || decoration instanceof NodeDecoration;

            if (hasAttributes) Object.assign(decoration.attrs, getThreadAttributes(threadID));

            return decoration.toPMDecoration();
          }
        );

        return DecorationSet.create(doc, [...diff, ...drawSuggestedComments(doc, comments)]);
      }
    }
  });

  editor.registerPlugin(decorations);
};
/** Calls run in parallel for page-close saves; false on failure. */
const saveSuggestions = async (
  host: EditorSuggesting,
  known: Map<string, EditorSuggestionPatch>,
  documents: SuggestionDocuments
) => {
  const used = new Set<string>();
  const patches = getSuggestionPatches(documents, getUnits(known));
  const isDiscussed = (threadID: string) => {
    return host.own.some((suggestion) => suggestion.threadID === threadID && suggestion.discussed);
  };
  const saves = patches.map(async (patch) => {
    const matches = [...known].filter(([id, saved]) => !used.has(id) && overlaps(saved, patch));
    const [threadID, current] = matches[0] ?? [];
    // Newer overlapping threads join the oldest and are deleted below, unless discussed.
    const kept = matches.slice(1).flatMap(([id]) => (isDiscussed(id) ? [id] : []));

    // Before the call, so a failed update doesn't delete the thread below.
    for (const id of threadID ? [threadID, ...kept] : kept) used.add(id);

    if (threadID && current && !isSamePatch(current, patch)) await host.update(threadID, patch);

    known.set(threadID ?? (await host.create(patch)), patch);
  });
  // Now, before saves add new threads to known.
  const removals = [...known.keys()]
    .filter((id) => !used.has(id))
    .map(async (threadID) => {
      const patch = known.get(threadID)!;

      // Before the call, as the deletion updates the user's suggestions.
      known.delete(threadID);

      // Discussed threads stay, with their old change.
      if (isDiscussed(threadID)) return;

      try {
        await host.remove(threadID);
      } catch (error) {
        known.set(threadID, patch);
        throw error;
      }
    });
  const results = await Promise.allSettled([...saves, ...removals]);

  return results.every((result) => result.status === "fulfilled" || isRejectedSave(result.reason));
};
/** Whether a block reads the same in the shared document, so comments on it anchor there. */
const isSharedBlock = (editor: Editor, blockID: string) => {
  const fork = (editor.storage.suggesting as SuggestingStorage | undefined)?.fork;
  const block = getBlocks(editor.state.doc).get(blockID);
  const main = fork && getBlocks(fork.getMainDoc(editor.schema)).get(blockID);

  if (!fork) return true;

  return Boolean(block && main && block.node.textContent === main.node.textContent);
};
/** Whether the smallest block around a range is shared, as the server anchors quotes in it. */
const isSharedRange = (editor: Editor, from: number, to: number) => {
  const $from = editor.state.doc.resolve(from);

  for (let depth = $from.sharedDepth(to); depth > 0; depth--) {
    const { id } = $from.node(depth).attrs;

    if (typeof id === "string") return isSharedBlock(editor, id);
  }

  return !editor.storage.suggesting;
};
/** Restarts the fork when one of the user's loaded suggestions is resolved or deleted. */
const syncOwnSuggestions = (editor: Editor, own: EditorOwnSuggestion[]) => {
  const ids = new Set(own.map(({ threadID }) => threadID));
  const storage = editor.storage.suggesting as SuggestingStorage | undefined;
  const isResolved = storage && [...storage.known.keys()].some((threadID) => !ids.has(threadID));

  if (isResolved) storage.restart();
};

const Suggesting = Extension.create<SuggestingOptions, SuggestingStorage>({
  name: "suggesting",
  addOptions() {
    return {
      fork: null,
      suggesting: () => undefined,
      restart: () => undefined,
      owner: null,
      renderBlock: null
    };
  },
  addStorage() {
    return {
      known: new Map(),
      restart: () => this.options.restart(),
      loading: false,
      pending: 0,
      host: this.options.suggesting(),
      fork: this.options.fork
    };
  },
  addDecorations() {
    const { editor, options } = this;

    return {
      create: ({ state }) => {
        const { doc, schema } = state;
        const title = doc.firstChild?.type.name === "title" ? doc.firstChild : null;
        const shown = doc.content.content.slice(title ? 1 : 0).map((node) => node.toJSON());
        const [mainTitle, ...main] = options.fork!.getMain(schema).content ?? [];
        const isTitleChanged =
          title && mainTitle?.type === "title" && !title.eq(schema.nodeFromJSON(mainTitle));
        const titleMarks = isTitleChanged ? diffPair(doc, 0, title.toJSON(), mainTitle, true) : [];
        const marks = [...titleMarks, ...diffBlocks(doc, title?.nodeSize ?? 0, shown, main, true)];

        return createForkDecorations(editor, doc, marks, options);
      }
    };
  },
  // Once per editor, as plugin views are rebuilt when plugins register.
  onCreate() {
    const { editor, options, storage } = this;
    const load = () => {
      const host = options.suggesting() ?? storage.host;
      const own = host?.own.filter(({ status }) => status === "active") ?? [];
      const { tr } = editor.state;
      const { loaded, merged } = loadOwnSuggestions(tr, own);

      storage.loading = true;
      editor.view.dispatch(tr.setMeta("addToHistory", false));
      storage.loading = false;

      // In the fork's JSON, so the next save sends only what differs.
      for (const suggestion of [...loaded, ...merged]) {
        const blocks = suggestion.blocks.map((block) => editor.schema.nodeFromJSON(block).toJSON());

        storage.known.set(suggestion.threadID, { ...toPatch(suggestion), blocks });
      }

      if (merged.length) storage.requestSave?.();
    };

    // After a previous fork's last saves, so it loads what they saved.
    void (savingByMain.get(options.fork!.main) ?? Promise.resolve(true)).then(() => {
      if (!editor.isDestroyed) load();
    });
  },
  addProseMirrorPlugins() {
    const { editor, options, storage } = this;
    const getDocuments = (): SuggestionDocuments => ({
      main: options.fork!.getMain(editor.schema),
      fork: editor.state.doc.toJSON()
    });
    // Reads the documents at its turn, after earlier saves and loads.
    const save = (read: () => SuggestionDocuments) => {
      const { host } = storage;
      const { main } = options.fork!;
      const previous = savingByMain.get(main) ?? Promise.resolve(true);

      if (!host) return previous;

      storage.pending += 1;

      const saving = previous
        .then(() => saveSuggestions(host, storage.known, read()))
        .catch(() => false)
        .finally(() => (storage.pending -= 1));

      savingByMain.set(main, saving);

      return saving;
    };

    return [
      new Plugin({
        view: () => {
          const schedule = (delay: number) => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
              saveTimer = undefined;
              void save(getDocuments).then((saved) => {
                if (destroyed) return;

                // New threads are in known now, so the preview stops drawing them.
                editor.commands.updateDecorations("suggestionPreview");

                if (!saved && !saveTimer) schedule(RETRY_DELAY);
              });
            }, delay);
          };
          const flush = () => {
            if (!saveTimer) return;

            // Now, as the fork closes before its turn.
            const documents = getDocuments();

            clearTimeout(saveTimer);
            saveTimer = undefined;
            void save(() => documents);
          };
          // A main change can keep the fork as it is yet change its marks, e.g. a removal both made.
          const redraw = () => {
            cancelAnimationFrame(redrawFrame);
            redrawFrame = requestAnimationFrame(() => {
              if (!destroyed) editor.commands.updateDecorations("suggesting");
            });
          };
          // Only while a save is sending; a waiting one is sent as the page closes.
          const warnUnsaved = (event: BeforeUnloadEvent) => {
            if (storage.pending) event.preventDefault();
          };

          let saveTimer: ReturnType<typeof setTimeout> | undefined;
          let redrawFrame = 0;
          let destroyed = false;

          storage.requestSave = () => schedule(SAVE_DELAY);
          options.fork!.main.on("update", redraw);
          window.addEventListener("pagehide", flush);
          window.addEventListener("beforeunload", warnUnsaved);

          return {
            update: (view, previous) => {
              const sync = ySyncPluginKey.getState(view.state);
              // Undo and redo also come from Y.js, but they're the user's edits.
              const isRemote = Boolean(sync?.isChangeOrigin && !sync.isUndoRedoOperation);

              storage.host = options.suggesting() ?? storage.host;

              if (view.state.doc.eq(previous.doc) || isRemote || storage.loading) return;

              schedule(SAVE_DELAY);
            },
            destroy: () => {
              destroyed = true;
              cancelAnimationFrame(redrawFrame);
              options.fork!.main.off("update", redraw);
              window.removeEventListener("pagehide", flush);
              window.removeEventListener("beforeunload", warnUnsaved);
              flush();
            }
          };
        }
      })
    ];
  }
});

export {
  createSuggestionFork,
  drawSuggestedBlock,
  isSharedBlock,
  isSharedRange,
  Suggesting,
  syncOwnSuggestions
};
