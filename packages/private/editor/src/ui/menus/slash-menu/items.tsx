import { createRef } from "@andesine/components";
import type { ElementViewOption, EditorMode } from "#editor/client-types";
import { acceptsType, getAccepts, getElementViews } from "#editor/lib/element-content";
import { capitalize, normalizeCategory } from "#editor/lib/labels";
import {
  getSchemaFields,
  getUnusedOptionalFields,
  insertOptionalField
} from "#editor/lib/optional-fields";
import { propertyTypeDetails } from "#editor/ui/views/property-view/menu";
import type { Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { FRAGMENT_BLOCK_TYPES, type ElementData, type FragmentBlockType } from "@andesine/document";
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
      label: "Bullet list",
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
      label: "Ordered list",
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
      label: "Task list",
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
      label: "Horizontal rule",
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
      label: "Code block",
      group: "Blocks",
      icon: "i-lucide:square-code",
      markdown: "```",
      shortcut: "$mod+alt+c",
      schemaKind: "block",
      schemaBlockType: "codeBlock",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor.chain().focus().deleteRange(range).setCodeBlock().run();
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
    ...Object.entries(propertyTypeDetails).map(([type, details]): SlashMenuItem => {
      return {
        label: details.label,
        group: "Property",
        markdown: "",
        icon: details.icon,
        schemaKind: "structure",
        ref: createRef<HTMLElement | null>(null),
        command({ editor, range }) {
          if (editor.state.doc.resolve(range.from).depth > 1) return false;

          return editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: "property",
                attrs: { type, value: details.value }
              },
              // The cursor stays in it, to add more properties.
              { type: "paragraph" }
            ])
            .run();
        }
      };
    })
  ];
};

const createOptionalFieldItems = (editor: Editor, state: EditorState): SlashMenuItem[] => {
  const fields = getSchemaFields(editor);

  if (state.selection.$from.parent.type.name !== "paragraph") return [];

  return getUnusedOptionalFields(fields, state.doc).map((field): SlashMenuItem => {
    const typeLabel =
      field.kind === "fragment" ? "Fragment" : `${propertyTypeDetails[field.type].label} property`;

    return {
      label: field.label || typeLabel,
      group: "Optional fields",
      icon:
        field.kind === "fragment" ? "i-lucide:letter-text" : propertyTypeDetails[field.type].icon,
      schemaKind: "structure",
      ref: createRef<HTMLElement | null>(null),
      command({ editor, range }) {
        return editor
          .chain()
          .focus()
          .deleteRange(range)
          .command(({ tr }) => {
            insertOptionalField(tr, fields, field);

            return true;
          })
          .run();
      }
    };
  });
};
/** Matches the nearest enclosing root, like element views. */
const isInsideRoot = (editor: Editor, roots: Set<string>, name: string): boolean => {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    const element = node.type.name === "element" && node.attrs.name?.toLowerCase();

    if (element && roots.has(element)) return element === name.toLowerCase();
  }

  return false;
};
/**
 * Elements with views, e.g. from extensions, inserted with their tags: in groups by their
 * categories, the same across extensions, then the "Elements" group for the rest.
 */
const createElementViewItems = (options: ElementViewOption[]): SlashMenuItem[] => {
  const roots = new Set(
    options.filter(({ parent }) => !parent).map(({ element }) => element.toLowerCase())
  );
  const getGroup = (option: ElementViewOption) => {
    const category = normalizeCategory(option.category);

    return category ? capitalize(category) : "Elements";
  };
  const categories = new Set(options.map(getGroup));

  categories.delete("Elements");

  const groups = [...categories, "Elements"];
  const sorted = [...options].sort((first, second) => {
    return groups.indexOf(getGroup(first)) - groups.indexOf(getGroup(second));
  });

  return sorted.map((option) => ({
    label: option.label,
    description: option.description,
    icon: option.icon ?? "i-lucide:code-xml",
    group: getGroup(option),
    schemaKind: "block",
    schemaBlockType: "element",
    element: option.element,
    ref: createRef<HTMLElement | null>(null),
    isAvailable: option.parent
      ? (editor) => isInsideRoot(editor, roots, option.parent!)
      : undefined,
    command({ editor, range }) {
      return editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertElement({
          name: option.element,
          selfClosing: option.selfClosing,
          props: option.props as ElementData["props"] | undefined
        })
        .run();
    }
  }));
};
/** Places the element items after the block items. */
const withElementItems = (
  items: SlashMenuItem[],
  elementItems: SlashMenuItem[]
): SlashMenuItem[] => {
  const index = items.findLastIndex((item) => item.group === "Blocks") + 1;

  return [...items.slice(0, index), ...elementItems, ...items.slice(index)];
};
const isSchemaControlled = (editor: Editor, state: EditorState): boolean => {
  let hasSchemaFields = getSchemaFields(editor).length > 0;

  state.doc.forEach((node) => {
    hasSchemaFields ||= typeof node.attrs.schemaFieldID === "string";
  });

  return hasSchemaFields;
};
const getAvailableSlashMenuItems = (
  items: SlashMenuItem[],
  editor: Editor,
  mode: EditorMode,
  state: EditorState = editor.state
): SlashMenuItem[] => {
  const { $from } = state.selection;
  const availableItems = items.filter((item) => {
    if (item.isAvailable && !item.isAvailable(editor)) return false;
    if (item.schemaBlockType === "element" && !editor.can().insertElement()) return false;
    if (item.schemaBlockType === "image") {
      const extension = editor.extensionManager.extensions.find(({ name }) => name === "images");

      return mode === "entry" && Boolean(extension?.options.images()?.enabled());
    }
    return item.schemaBlockType !== "table" || canInsertTable(editor, $from.pos);
  });

  const elementViews = getElementViews(editor);
  // The block replaces the paragraph with the slash, so its parent's content rules apply.
  const accepts =
    elementViews && $from.depth > 1
      ? getAccepts(state.doc, $from.before($from.depth - 1), elementViews)
      : null;

  let fragmentDepth = -1;

  if (isInsideTableCell($from)) return [];

  if (accepts) {
    return availableItems.filter((item) => {
      // Structure items, e.g. fragments and properties, are only for the top level.
      const isBlock = item.schemaKind === "block";
      // The "Element" item inserts any element, so only without an `accepts` list.
      const isAnyElement = item.schemaBlockType === "element" && !item.element;

      if (!isBlock) return false;
      if (isAnyElement) return !accepts.accepts;

      return acceptsType(accepts, item.schemaBlockType ?? "paragraph", item.element);
    });
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "fragment") {
      fragmentDepth = depth;
      break;
    }
  }

  if (fragmentDepth === -1) {
    if (mode === "entry" && isSchemaControlled(editor, state)) {
      return createOptionalFieldItems(editor, state);
    }

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

export {
  createElementViewItems,
  createSlashMenuItems,
  getAvailableSlashMenuItems,
  isInsideTableCell,
  withElementItems
};
