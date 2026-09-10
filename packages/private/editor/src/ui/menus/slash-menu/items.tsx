import { createRef } from "@andesine/components";
import type { EditorMode } from "#editor/client-types";
import type { Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { FRAGMENT_BLOCK_TYPES, type FragmentBlockType } from "#editor/schema/fragment";
import type { SlashMenuItem } from "./component";

const isInsideTableCell = ($pos: ResolvedPos): boolean => {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (["tableCell", "tableHeader"].includes($pos.node(depth).type.name)) return true;
  }

  return false;
};
const canInsertTable = (editor: Editor, pos: number): boolean => {
  const { doc } = editor.state;
  const $pos = doc.resolve(pos);
  const parent = $pos.depth > 0 ? $pos.node($pos.depth - 1) : null;
  const index = $pos.depth > 0 ? $pos.index($pos.depth - 1) : 0;

  let schemaControlled = false;

  if ($pos.parent.type.name !== "paragraph") return false;

  if (parent?.type.name === "fragment") {
    return (
      !Array.isArray(parent.attrs.allowedBlocks) || parent.attrs.allowedBlocks.includes("table")
    );
  }

  if (parent?.type.name === "element")
    return parent.canReplaceWith(index, index + 1, editor.schema.nodes.table);

  if (parent !== doc) return false;

  doc.forEach((node) => {
    if (
      ["fragment", "property"].includes(node.type.name) &&
      typeof node.attrs.schemaFieldID === "string"
    ) {
      schemaControlled = true;
    }
  });

  return !schemaControlled && parent.canReplaceWith(index, index + 1, editor.schema.nodes.table);
};

const createSlashMenuItems = (): SlashMenuItem[] => {
  const headingLevels = [1, 2, 3, 4, 5, 6] as const;
  const headingIcons = [
    "i-lucide:heading-1",
    "i-lucide:heading-2",
    "i-lucide:heading-3",
    "i-lucide:heading-4",
    "i-lucide:heading-5",
    "i-lucide:heading-6"
  ];
  const propertyTypes = [
    { type: "text", label: "Text", icon: "i-lucide:text", value: "" },
    { type: "number", label: "Number", icon: "i-lucide:hash", value: "" },
    { type: "checkbox", label: "Checkbox", icon: "i-lucide:square-check", value: false },
    { type: "date", label: "Date", icon: "i-lucide:calendar", value: "" },
    { type: "url", label: "URL", icon: "i-lucide:link", value: "" },
    { type: "select", label: "Select", icon: "i-lucide:circle-chevron-down", value: "" },
    {
      type: "multi-select",
      label: "Multi-select",
      icon: "i-lucide:list-collapse",
      value: []
    }
  ] as const;

  return [
    ...headingLevels.map((headingLevel): SlashMenuItem => ({
      icon: headingIcons[headingLevel - 1],
      label: `Heading ${headingLevel}`,
      group: "Headings",
      markdown: "#".repeat(headingLevel),
      shortcut: `$mod+alt+${headingLevel}`,
      schemaKind: "block",
      schemaBlockType: "heading",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).setHeading({ level: headingLevel }).run();
      }
    })),
    {
      label: "Bullet List",
      group: "Lists",
      markdown: "- ",
      shortcut: "$mod+shift+8",
      schemaKind: "block",
      schemaBlockType: "bulletList",
      icon: "i-lucide:list",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).toggleBulletList().run();
      }
    },
    {
      label: "Ordered List",
      icon: "i-lucide:list-ordered",
      group: "Lists",
      markdown: "1. ",
      shortcut: "$mod+shift+7",
      schemaKind: "block",
      schemaBlockType: "orderedList",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      }
    },
    {
      label: "Task List",
      icon: "i-lucide:list-checks",
      group: "Lists",
      markdown: "[] ",
      shortcut: "$mod+shift+9",
      schemaKind: "block",
      schemaBlockType: "taskList",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).toggleTaskList().run();
      }
    },
    {
      label: "Blockquote",
      group: "Blocks",
      markdown: "> ",
      shortcut: "$mod+shift+b",
      schemaKind: "block",
      schemaBlockType: "blockquote",
      icon: "i-lucide:text-quote",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).setBlockquote().run();
      }
    },
    {
      label: "Horizontal Rule",
      icon: "i-lucide:minus",
      group: "Blocks",
      schemaKind: "block",
      schemaBlockType: "horizontalRule",
      markdown: "---",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      }
    },
    {
      label: "Element",
      group: "Blocks",
      icon: "i-lucide:code-xml",
      schemaKind: "block",
      schemaBlockType: "element",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).insertElement().run();
      }
    },
    {
      label: "Image",
      group: "Blocks",
      icon: "i-lucide:image",
      schemaKind: "block",
      schemaBlockType: "image",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).insertContent({ type: "image" }).run();
      }
    },
    {
      label: "Table",
      group: "Blocks",
      icon: "i-lucide:table",
      schemaKind: "block",
      schemaBlockType: "table",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        if (!canInsertTable(editor, range.from)) return false;

        return editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      }
    },
    {
      label: "Fragment",
      group: "Structure",
      markdown: "",
      icon: "i-lucide:letter-text",
      schemaKind: "structure",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: "fragment", content: [{ type: "paragraph", content: [] }] })
          .run();
      }
    },
    ...propertyTypes.map((propertyType): SlashMenuItem => {
      return {
        label: propertyType.label,
        group: "Property",
        markdown: "",
        icon: propertyType.icon,
        schemaKind: "structure",
        ref: createRef<HTMLElement | null>(null),
        command({ editor, range }) {
          if (editor.state.doc.resolve(range.from).depth > 1) return false;

          return editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "property",
              attrs: { type: propertyType.type, value: propertyType.value }
            })
            .run();
        }
      };
    })
  ];
};

const getAvailableSlashMenuItems = (
  items: SlashMenuItem[],
  editor: Editor,
  mode: EditorMode
): SlashMenuItem[] => {
  const { $from } = editor.state.selection;
  const availableItems = items.filter((item) => {
    if (item.schemaBlockType === "element" && !editor.can().insertElement()) return false;
    if (item.schemaBlockType === "image") {
      const extension = editor.extensionManager.extensions.find(({ name }) => name === "images");

      return mode === "entry" && Boolean(extension?.options.images()?.enabled());
    }
    return item.schemaBlockType !== "table" || canInsertTable(editor, $from.pos);
  });

  let fragmentDepth = -1;

  if (isInsideTableCell($from)) return [];

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "fragment") {
      fragmentDepth = depth;
      break;
    }
  }

  if (fragmentDepth === -1) {
    if (mode === "entry") {
      return availableItems.filter((item) => item.schemaKind === "block" || $from.depth <= 1);
    }

    return availableItems.filter((item) => item.schemaKind === "structure");
  }

  const fragment = $from.node(fragmentDepth);
  const allowedBlocks = Array.isArray(fragment.attrs.allowedBlocks)
    ? (fragment.attrs.allowedBlocks as FragmentBlockType[])
    : [...FRAGMENT_BLOCK_TYPES];

  return availableItems.filter((item) => {
    return (
      item.schemaKind === "block" &&
      (item.schemaBlockType === "paragraph" ||
        allowedBlocks.includes(item.schemaBlockType as FragmentBlockType))
    );
  });
};

export { createSlashMenuItems, getAvailableSlashMenuItems, isInsideTableCell };
