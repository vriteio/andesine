import type { Editor, EditorEvents } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import { presentableDiff } from "@codemirror/merge";
import { findCodeLanguage } from "./code-languages";
import { isPositionInInheritedField } from "../ui/block-utils";
import type { CodeFormatRequest, CodeFormatResponse } from "./code-format-worker";
import CodeFormatWorker from "./code-format-worker?worker";

const parsers: Record<string, string> = {
  javascript: "babel",
  jsx: "babel",
  typescript: "typescript",
  tsx: "typescript",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  markdown: "markdown",
  yaml: "yaml"
};
const pending = new WeakMap<Editor, Set<string | number>>();
const getCodeFormatParser = (language: string): string | undefined => {
  const name = findCodeLanguage(language)?.name.toLowerCase() || language.toLowerCase();

  return Object.hasOwn(parsers, name) ? parsers[name] : undefined;
};
const formatCode = (request: CodeFormatRequest): Promise<string> => {
  return new Promise((resolve, reject) => {
    const worker = new CodeFormatWorker();
    const finish = (error?: string, formatted?: string) => {
      clearTimeout(timeout);
      worker.terminate();
      if (error) reject(new Error(error));
      else resolve(formatted!);
    };
    const timeout = setTimeout(() => finish("Code formatting took too long. Try again."), 60000);

    worker.onmessage = (event: MessageEvent<CodeFormatResponse>) => {
      finish(event.data.error, event.data.formatted);
    };
    worker.onerror = () => finish("Could not load the code formatter. Try again.");
    worker.onmessageerror = () => finish("Could not read the formatted code. Try again.");
    worker.postMessage(request);
  });
};
const formatCodeBlock = async (
  editor: Editor,
  pos: number,
  notify?: (type: "success" | "error", text: string) => void
): Promise<void> => {
  const node = editor.state.doc.nodeAt(pos);
  const parser = getCodeFormatParser(String(node?.attrs.language || ""));
  const active = pending.get(editor) || new Set<string | number>();
  const key = node?.attrs.id || pos;

  if (
    editor.isDestroyed ||
    !editor.isEditable ||
    node?.type.name !== "codeBlock" ||
    !parser ||
    active.has(key) ||
    isPositionInInheritedField(editor.state.doc, pos)
  )
    return;

  const source = node.textContent;
  const onTransaction = ({ transaction }: EditorEvents["transaction"]) => {
    position = transaction.mapping.map(position, 1);
    const current = transaction.doc.nodeAt(position);

    stale ||=
      current?.type !== node.type ||
      current.attrs.id !== node.attrs.id ||
      current.attrs.language !== node.attrs.language ||
      current.textContent !== source;
  };
  let position = pos;
  let stale = false;

  active.add(key);
  pending.set(editor, active);
  editor.on("transaction", onTransaction);
  try {
    const formatted = await formatCode({ source, parser });

    if (editor.isDestroyed) return;
    if (stale) {
      notify?.("error", "Code or language changed during formatting. Try again.");
      return;
    }
    if (!editor.isEditable || isPositionInInheritedField(editor.state.doc, position)) return;
    if (formatted === source) return;

    const tr = closeHistory(editor.state.tr);
    const changes = presentableDiff(source, formatted, { scanLimit: 500 });
    const undoManager = yUndoPluginKey.getState(editor.state)?.undoManager;

    for (const change of changes.toReversed()) {
      tr.replaceWith(
        position + 1 + change.fromA,
        position + 1 + change.toA,
        change.fromB === change.toB
          ? []
          : editor.schema.text(formatted.slice(change.fromB, change.toB))
      );
    }
    undoManager?.stopCapturing();
    editor.view.dispatch(tr);
    undoManager?.stopCapturing();
    editor.view.dispatch(closeHistory(editor.state.tr));
  } catch (error) {
    if (!editor.isDestroyed)
      notify?.("error", error instanceof Error ? error.message : "Could not format code.");
  } finally {
    editor.off("transaction", onTransaction);
    active.delete(key);
  }
};

export { getCodeFormatParser, formatCodeBlock };
