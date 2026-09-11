import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Combobox, type MenuItem } from "@andesine/components";
import type { Editor } from "@tiptap/core";
import { codeLanguageOptions, findCodeLanguage } from "../../../lib/code-languages";
import { isPositionInInheritedField } from "../../block-utils";
import { formatCodeBlock, getCodeFormatParser } from "../../../lib/code-format";

interface CodeBlockTarget {
  pos: number;
  node: ProseMirrorNode;
}

const createCodeBlockMenuItems = (
  editor: Editor,
  notify: (type: "success" | "error", text: string) => void
): NonNullable<MenuItem["items"]> => {
  const { selection, doc } = editor.state;
  const pos =
    selection.$from.parent.type.name === "codeBlock" ? selection.$from.before() : selection.from;
  const node = doc.nodeAt(pos);

  if (node?.type.name !== "codeBlock" || !editor.isEditable || isPositionInInheritedField(doc, pos))
    return [];

  const currentLanguage =
    node.attrs.language === "plaintext" ? "" : String(node.attrs.language || "");
  const knownLanguage = findCodeLanguage(currentLanguage);
  const value = knownLanguage?.name.toLowerCase() || currentLanguage || "plaintext";
  const options =
    currentLanguage && !knownLanguage
      ? [...codeLanguageOptions, { label: currentLanguage, value: currentLanguage }]
      : codeLanguageOptions;
  const findCurrent = (): CodeBlockTarget | null => {
    const results: CodeBlockTarget[] = [];

    editor.state.doc.descendants((current, position) => {
      if (current.type.name === "codeBlock" && current.attrs.id === node.attrs.id)
        results.push({ pos: position, node: current });
    });
    return results[0] || null;
  };

  return [
    [
      () => (
        <div class="flex w-full min-w-0 flex-col gap-1 p-1 md:max-w-60">
          <Combobox
            class="w-full min-w-0"
            closeOnSelect
            displaySelectedLabel
            label="Language"
            openOnFocus={false}
            preventAutoFocus
            options={options}
            value={value}
            placeholder="Select language"
            surfaceClass="!bg-gray-50"
            scrollableContainerClass="scrollbar-base max-h-56"
            setValue={(language) => {
              const current = findCurrent();
              if (
                !current ||
                !editor.isEditable ||
                isPositionInInheritedField(editor.state.doc, current.pos)
              )
                return;
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(current.pos, undefined, {
                  ...current.node.attrs,
                  language: language === "plaintext" ? null : language
                })
              );
            }}
          />
        </div>
      )
    ],
    [
      ...(getCodeFormatParser(currentLanguage)
        ? [
            {
              label: "Format code",
              icon: "i-lucide:align-left",
              shortcut: "$mod+shift+f",
              onClick: () => {
                const current = findCurrent();
                if (current) void formatCodeBlock(editor, current.pos, notify);
              }
            }
          ]
        : []),
      {
        label: "Copy code",
        icon: "i-lucide:copy",
        onClick: () => {
          const current = findCurrent();
          if (!current) return;
          void navigator.clipboard
            .writeText(current.node.textContent)
            .catch(() => notify("error", "Failed to copy code to the clipboard."));
        }
      }
    ]
  ];
};

export { createCodeBlockMenuItems };
