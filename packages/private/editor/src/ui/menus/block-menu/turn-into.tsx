import { findDisallowedElementBlock, FRAGMENT_BLOCK_TYPES } from "@andesine/document";
import type { MenuItem } from "@andesine/components";
import type { Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { isPositionInInheritedField } from "#editor/ui/block-utils";
import { acceptsBlock, getAccepts, getElementViews } from "#editor/lib/element-content";

interface ConversionOption {
  name: string;
  label: string;
  icon: string;
  level?: number;
}

const listOptions: ConversionOption[] = [
  { name: "bulletList", label: "Bullet list", icon: "i-lucide:list" },
  { name: "orderedList", label: "Ordered list", icon: "i-lucide:list-ordered" },
  { name: "taskList", label: "Task list", icon: "i-lucide:list-checks" }
];
const textOptions: ConversionOption[] = [
  { name: "codeBlock", label: "Code block", icon: "i-lucide:square-code" },
  { name: "paragraph", label: "Paragraph", icon: "i-lucide:pilcrow" },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({
    name: "heading",
    label: `Heading ${level}`,
    icon: `i-lucide:heading-${level}`,
    level
  })),
  { name: "blockquote", label: "Blockquote", icon: "i-lucide:text-quote" }
];
const getSelectedBlocks = (editor: Editor) => {
  const { doc, selection } = editor.state;

  if (
    !editor.isEditable ||
    !isBlockSelection(selection) ||
    !selection.$from.sameParent(selection.$to) ||
    (selection.$from.parent !== doc &&
      !["fragment", "element"].includes(selection.$from.parent.type.name)) ||
    isPositionInInheritedField(doc, selection.from)
  ) {
    return null;
  }

  const nodes: ProseMirrorNode[] = [];

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (pos < selection.from) return true;

    nodes.push(node);

    return false;
  });

  return nodes.length ? { nodes, selection } : null;
};
const isListName = (name: string): boolean => listOptions.some((option) => option.name === name);
const isOptionAllowed = (node: ProseMirrorNode, option: ConversionOption): boolean => {
  if (isListName(node.type.name)) return isListName(option.name) || option.name === "paragraph";
  if (node.type.name === "paragraph") return true;

  return textOptions.some(({ name }) => name === node.type.name) && textOptions.includes(option);
};
const getListBlocks = (list: ProseMirrorNode): ProseMirrorNode[] => {
  const blocks: ProseMirrorNode[] = [];

  list.forEach((item) => {
    item.forEach((child) => {
      blocks.push(...(isListName(child.type.name) ? getListBlocks(child) : [child]));
    });
  });

  return blocks;
};
const isConverted = (node: ProseMirrorNode, option: ConversionOption): boolean => {
  return node.type.name === option.name && (!option.level || node.attrs.level === option.level);
};
const getConvertedContent = (
  editor: Editor,
  node: ProseMirrorNode,
  option: ConversionOption
): Fragment | null => {
  const type = editor.schema.nodes[option.name];
  const children: ProseMirrorNode[] = [];

  if (!type) return null;

  if (option.name === "paragraph" && isListName(node.type.name)) {
    return Fragment.from(getListBlocks(node));
  }

  if (isListName(option.name) && !isListName(node.type.name)) {
    const itemType = editor.schema.nodes[option.name === "taskList" ? "taskItem" : "listItem"];
    const item = itemType?.create(null, node);

    return item && type.validContent(Fragment.from(item))
      ? Fragment.from(type.create(null, item))
      : null;
  }

  if (isListName(node.type.name)) {
    const itemType = editor.schema.nodes[option.name === "taskList" ? "taskItem" : "listItem"];

    if (!itemType) return null;

    node.forEach((item) => {
      children.push(itemType.create(item.attrs, item.content, item.marks));
    });

    if (!children.every((item) => item.type.validContent(item.content))) return null;

    const content = Fragment.from(children);

    return type.validContent(content) ? Fragment.from(type.create(node.attrs, content)) : null;
  }

  if (option.name === "blockquote") {
    return type.validContent(Fragment.from(node)) ? Fragment.from(type.create(null, node)) : null;
  }

  const content = node.type.name === "blockquote" ? node.content : Fragment.from(node);

  content.forEach((child) => {
    children.push(
      child.isTextblock
        ? type.create(
            { ...child.attrs, level: option.level },
            option.name === "codeBlock"
              ? child.content.size
                ? editor.schema.text(child.textBetween(0, child.content.size, "\n", "\n"))
                : undefined
              : child.content,
            child.marks
          )
        : child
    );
  });

  return children.every((child) => child.type.validContent(child.content))
    ? Fragment.from(children)
    : null;
};
const getConvertedBlocks = (
  editor: Editor,
  nodes: ProseMirrorNode[],
  option: ConversionOption
): Fragment | null => {
  const blocks: ProseMirrorNode[] = [];

  for (const node of nodes) {
    const content = isConverted(node, option)
      ? Fragment.from(node)
      : getConvertedContent(editor, node, option);

    if (!content) return null;

    content.forEach((block) => blocks.push(block));
  }

  if (!isListName(option.name)) return Fragment.from(blocks);

  // A set of blocks becomes one list, not a list for each block.
  const items = blocks.flatMap((block) => block.content.content);

  return Fragment.from(blocks[0].type.create(blocks[0].attrs, Fragment.from(items)));
};
const createTurnIntoMenuItem = (editor: Editor): NonNullable<MenuItem["items"]> => {
  const blocks = getSelectedBlocks(editor);

  if (!blocks) return [];

  const { nodes, selection } = blocks;
  const { doc } = editor.state;
  const options = [...textOptions, ...listOptions].filter((option) => {
    return nodes.every((node) => isOptionAllowed(node, option));
  });

  const elementViews = getElementViews(editor);
  // The parent element's content rules, e.g. only `Tab` elements in `Tabs`.
  const accepts =
    elementViews && selection.$from.depth > 0
      ? getAccepts(editor.state.doc, selection.$from.before(), elementViews)
      : null;

  let allowedBlocks: readonly string[] | null = null;

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const ancestor = selection.$from.node(depth);

    if (ancestor.type.name !== "fragment") continue;

    allowedBlocks = Array.isArray(ancestor.attrs.allowedBlocks)
      ? ancestor.attrs.allowedBlocks
      : FRAGMENT_BLOCK_TYPES;
    break;
  }

  const items = options.flatMap((option): MenuItem[] => {
    const selected = nodes.every((node) => isConverted(node, option));
    const content = getConvertedBlocks(editor, nodes, option);
    const parent = selection.$from.parent;
    const enabledLevels = editor.extensionManager.extensions.find(({ name }) => name === "heading")
      ?.options.enabledLevels;

    if (option.level && enabledLevels && !enabledLevels.includes(option.level)) return [];
    if (!content || !parent.canReplace(selection.$from.index(), selection.$to.index(), content))
      return [];

    if (allowedBlocks && findDisallowedElementBlock(content.toJSON() || [], allowedBlocks)) {
      return [];
    }

    const fits = !accepts || content.content.every((converted) => acceptsBlock(accepts, converted));

    if (!selected && !fits) return [];

    return [
      {
        label: option.label,
        icon: option.icon,
        selected,
        onClick: () => {
          if (selected || editor.isDestroyed) return;

          if (editor.state.doc !== doc || !editor.state.selection.eq(selection)) return;

          editor
            .chain()
            .command(({ tr, commands }) => {
              tr.replaceWith(selection.from, selection.to, content);

              return commands.setBlockSelection({
                from: selection.from,
                to: selection.from + content.size,
                depth: selection.$from.depth
              });
            })
            .run();
        }
      }
    ];
  });

  return items.some(({ selected }) => !selected)
    ? [{ label: "Turn into", icon: "i-lucide:repeat", items }]
    : [];
};

export { createTurnIntoMenuItem };
