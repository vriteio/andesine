import { codeViews, type CodeBlockBridge } from "./navigation";
import { leaveCodeBlock } from "../../../schema/blocks/code-block";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  RangeSet,
  type Range
} from "@codemirror/state";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching, foldKeymap, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  Decoration,
  EditorView,
  keymap,
  drawSelection,
  lineNumbers,
  type DecorationSet,
  type ViewUpdate
} from "@codemirror/view";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { NodeViewRenderer } from "@tiptap/core";
import { Selection, TextSelection } from "@tiptap/pm/state";
import { untrack } from "solid-js";
import type { EditorDiff } from "../../../client-types";
import { findCodeLanguage } from "../../../lib/code-languages";
import { isPositionInInheritedField } from "../../block-utils";
import { createBlockRangeSelection } from "../../../extensions/block-selection";
import { getCodePresence } from "./presence";
import { syntaxHighlightStyle } from "../../../lib/syntax-highlight";
import { codeBlockScrollShadows } from "./scroll";
import { createCodeBlockViewport } from "./viewport";
import { codeBlockFoldGutter, codeBlockIndentGuides } from "./guides";
import { formatCodeBlock, getCodeFormatParser } from "../../../lib/code-format";

interface CodeBlockViewOptions {
  awareness: HocuspocusProvider["awareness"];
  editable(): boolean;
  diff?: EditorDiff;
  notify?(type: "success" | "error", text: string): void;
}
const setShades = StateEffect.define<DecorationSet>();
const shades = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    const effect = transaction.effects.find((effect) => effect.is(setShades));

    return effect ? effect.value : value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field)
});
const createCodeBlockViewRenderer =
  (options: CodeBlockViewOptions): NodeViewRenderer =>
  (props) => {
    const { editor, getPos } = props;
    const dom = document.createElement("div");
    const language = new Compartment();
    const writable = new Compartment();
    let node = props.node;
    let updating = false;
    let forwarding = false;
    let destroyed = false;
    let scheduled = false;
    let languageName: string | null = null;
    let languageGeneration = 0;
    let focusRequested = false;

    dom.dataset.codeBlock = "";
    dom.dataset.type = "codeBlock";
    dom.className = "code-block-node not-prose";
    dom.contentEditable = "false";

    const canEdit = () => {
      const pos = getPos();

      return (
        untrack(options.editable) &&
        editor.isEditable &&
        typeof pos === "number" &&
        !isPositionInInheritedField(editor.state.doc, pos)
      );
    };
    const forwardUpdate = (update: ViewUpdate) => {
      if (
        updating ||
        destroyed ||
        (!update.docChanged && !update.selectionSet && !update.focusChanged)
      )
        return;

      const pos = getPos();

      if (typeof pos !== "number" || (!update.view.hasFocus && !update.docChanged)) return;

      if (update.docChanged && !canEdit()) {
        scheduleSync();
        return;
      }

      const tr = editor.state.tr;
      const main = update.state.selection.main;
      let offset = pos + 1;

      forwarding = true;
      try {
        update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
          tr.replaceWith(
            offset + fromA,
            offset + toA,
            text.length ? editor.schema.text(text.toString()) : []
          );
          offset += toB - fromB - (toA - fromA);
        });
        const selection = TextSelection.create(tr.doc, pos + 1 + main.anchor, pos + 1 + main.head);

        if (tr.docChanged || !selection.eq(tr.selection)) {
          editor.view.dispatch(tr.setSelection(selection));
        }
      } finally {
        forwarding = false;
        scheduleSync();
      }
    };
    const leave = (forward: boolean, extend: boolean) => {
      const pos = getPos();

      if (typeof pos !== "number") return false;

      const state = editor.state;
      const boundary = forward ? pos + node.nodeSize : pos;
      const next = Selection.near(state.doc.resolve(boundary), forward ? 1 : -1);

      if (next.$head.parent === node) return false;

      const selection = extend
        ? TextSelection.between(state.selection.$anchor, next.$head, forward ? 1 : -1)
        : next;

      editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
      editor.view.focus();
      return true;
    };
    const arrow =
      (forward: boolean, vertical: boolean, extend = false) =>
      (view: EditorView) => {
        const main = view.state.selection.main;
        const edge = forward ? view.state.doc.length : 0;
        const atBoundary = vertical
          ? view.moveToLineBoundary(main, forward, true).head === edge
          : main.head === edge;

        if ((!main.empty && !extend) || !atBoundary || view.composing) return false;

        return leave(forward, extend);
      };
    const code = new EditorView({
      parent: dom,
      state: EditorState.create({
        doc: node.textContent,
        extensions: [
          language.of([]),
          writable.of([EditorState.readOnly.of(!canEdit()), EditorView.editable.of(canEdit())]),
          EditorState.tabSize.of(2),
          EditorState.lineSeparator.of("\n"),
          indentUnit.of("  "),
          syntaxHighlighting(syntaxHighlightStyle),
          bracketMatching(),
          closeBrackets(),
          drawSelection(),
          lineNumbers(),
          codeBlockFoldGutter,
          codeBlockIndentGuides,
          codeBlockScrollShadows,
          shades,
          EditorView.contentAttributes.of({
            "aria-label": "Code block",
            "tabindex": "0",
            "spellcheck": "false"
          }),
          EditorView.updateListener.of(forwardUpdate),
          keymap.of([
            {
              key: "Mod-Shift-f",
              run: () => {
                const pos = getPos();
                if (
                  !canEdit() ||
                  typeof pos !== "number" ||
                  !getCodeFormatParser(String(node.attrs.language || ""))
                )
                  return false;
                void formatCodeBlock(editor, pos, options.notify);
                return true;
              }
            },
            {
              key: "Mod-Enter",
              run: () => {
                if (canEdit()) leaveCodeBlock(editor);
                return true;
              }
            },
            {
              key: "Mod-z",
              run: () => {
                if (canEdit()) editor.commands.undo?.();
                return true;
              }
            },
            {
              key: "Mod-Shift-z",
              run: () => {
                if (canEdit()) editor.commands.redo?.();
                return true;
              }
            },
            {
              key: "Mod-y",
              run: () => {
                if (canEdit()) editor.commands.redo?.();
                return true;
              }
            },
            {
              key: "Mod-Alt-c",
              run: () => {
                const converted = canEdit() && editor.commands.toggleCodeBlock();

                if (converted) editor.view.focus();

                return converted;
              }
            },
            {
              key: "Escape",
              run: () => {
                const pos = getPos();
                if (typeof pos !== "number") return false;
                editor.view.dispatch(
                  editor.state.tr.setSelection(
                    createBlockRangeSelection(editor.state.doc, {
                      from: pos,
                      to: pos + node.nodeSize,
                      depth: editor.state.doc.resolve(pos).depth
                    })
                  )
                );
                editor.view.focus();
                return true;
              }
            },
            {
              key: "Backspace",
              run: (view) => {
                const converted =
                  !view.state.doc.length && canEdit() && editor.commands.clearNodes();

                if (converted) editor.view.focus();

                return converted;
              }
            },
            { key: "ArrowUp", run: arrow(false, true), shift: arrow(false, true, true) },
            { key: "ArrowDown", run: arrow(true, true), shift: arrow(true, true, true) },
            { key: "ArrowLeft", run: arrow(false, false), shift: arrow(false, false, true) },
            { key: "ArrowRight", run: arrow(true, false), shift: arrow(true, false, true) },
            indentWithTab,
            ...closeBracketsKeymap,
            ...foldKeymap,
            ...defaultKeymap
          ]),
          EditorView.theme({
            "&": { fontSize: "inherit", backgroundColor: "transparent", color: "#24292e" },
            "&.cm-focused": { outline: "none" },
            ".cm-scroller": { fontFamily: "inherit", overflowX: "auto" },
            ".cm-content": { padding: "0", minHeight: "1.25rem", lineHeight: "1.25rem" },
            ".cm-line": { padding: "0" },
            ".cm-cursor": { borderLeftColor: "currentColor" }
          })
        ]
      })
    });
    const bridge: CodeBlockBridge = { editor, getPos, code };
    const destroyViewport = createCodeBlockViewport(editor, dom, code);

    codeViews.set(dom, bridge);

    const sync = () => {
      scheduled = false;
      if (destroyed || editor.isDestroyed) return;
      if (forwarding) {
        scheduleSync();
        return;
      }

      const pos = getPos();
      if (typeof pos !== "number") return;

      const current = editor.state.doc.nodeAt(pos);
      if (current?.type !== node.type) return;
      node = current;

      const text = node.textContent;
      const old = code.state.doc.toString();
      const selection = editor.state.selection;
      const start = pos + 1;
      const end = start + text.length;
      const inside =
        selection instanceof TextSelection && selection.from >= start && selection.to <= end;
      const editable = canEdit();
      const effects: StateEffect<unknown>[] = [];
      const decorations: Array<Range<Decoration>> = getCodePresence(
        editor,
        options.awareness,
        start,
        text.length
      );
      let changes: { from: number; to: number; insert: string } | undefined;

      if (text !== old) {
        let from = 0;
        let suffix = 0;
        while (from < text.length && from < old.length && text[from] === old[from]) from += 1;
        while (
          suffix < text.length - from &&
          suffix < old.length - from &&
          text[text.length - suffix - 1] === old[old.length - suffix - 1]
        )
          suffix += 1;
        changes = { from, to: old.length - suffix, insert: text.slice(from, text.length - suffix) };
      }
      if (code.state.readOnly === editable) {
        effects.push(
          writable.reconfigure([
            EditorState.readOnly.of(!editable),
            EditorView.editable.of(editable)
          ])
        );
      }
      if (
        selection instanceof TextSelection &&
        !inside &&
        selection.from < end &&
        selection.to > start
      ) {
        const from = Math.max(0, selection.from - start);
        const to = Math.min(text.length, selection.to - start);

        if (from < to) {
          decorations.push(Decoration.mark({ class: "code-block-selection" }).range(from, to));
        }
      }
      for (const change of options.diff?.changes || []) {
        const from = Math.max(0, change.from - start);
        const to = Math.min(text.length, change.to - start);
        if (change.inline && from < to) {
          decorations.push(
            Decoration.mark({
              class: `version-diff-inline version-diff-${change.type}${change.type === "removed" ? " version-diff-removed-inline" : ""}`
            }).range(from, to)
          );
        }
      }
      const nextShades = Decoration.set(decorations, true);
      const main = code.state.selection.main;
      const nextSelection = inside
        ? { anchor: selection.anchor - start, head: selection.head - start }
        : { anchor: Math.min(main.head, text.length), head: Math.min(main.head, text.length) };
      const selectionChanged =
        main.anchor !== nextSelection.anchor || main.head !== nextSelection.head;

      if (changes || !RangeSet.eq([code.state.field(shades)], [nextShades])) {
        effects.push(setShades.of(nextShades));
      }
      updating = true;
      try {
        if (changes || effects.length || selectionChanged)
          code.dispatch({
            changes,
            effects,
            selection: nextSelection
          });
        if (inside && focusRequested) {
          code.focus();
          code.dispatch({
            effects: EditorView.scrollIntoView(selection.head - start, { y: "nearest" })
          });
        }
        focusRequested = false;
      } finally {
        updating = false;
      }

      const nextLanguage = String(node.attrs.language || "");
      if (nextLanguage !== languageName) {
        languageName = nextLanguage;
        languageGeneration += 1;
        const generation = languageGeneration;
        const description = findCodeLanguage(nextLanguage);

        code.dispatch({ effects: language.reconfigure([]) });
        if (description) {
          void description
            .load()
            .then((support) => {
              if (!destroyed && generation === languageGeneration)
                code.dispatch({ effects: language.reconfigure(support) });
            })
            .catch(() => {
              /* Plain text remains editable if a language cannot load. */
            });
        }
      }
    };
    function scheduleSync() {
      if (scheduled || destroyed) return;
      scheduled = true;
      queueMicrotask(sync);
    }
    const selectBlock = (event: PointerEvent) => {
      const pos = getPos();

      if (event.button !== 2 || !canEdit() || typeof pos !== "number") return;

      editor.commands.setBlockSelection({
        from: pos,
        to: pos + node.nodeSize,
        depth: editor.state.doc.resolve(pos).depth
      });
    };

    dom.addEventListener("pointerdown", selectBlock);
    editor.on("transaction", scheduleSync);
    options.awareness?.on("change", scheduleSync);
    scheduleSync();

    return {
      dom,
      update(next) {
        if (next.type !== node.type) return false;
        node = next;
        scheduleSync();
        return true;
      },
      setSelection() {
        focusRequested = true;
        scheduleSync();
      },
      stopEvent: () => true,
      ignoreMutation: () => true,
      destroy() {
        destroyed = true;
        destroyViewport();
        editor.off("transaction", scheduleSync);
        options.awareness?.off("change", scheduleSync);
        dom.removeEventListener("pointerdown", selectBlock);
        codeViews.delete(dom);
        code.destroy();
      }
    };
  };

export { createCodeBlockViewRenderer };
