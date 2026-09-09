import type { MenuItem } from "@andesine/components";
import type { Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { isPositionInInheritedField } from "#editor/ui/block-utils";

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
  { name: "paragraph", label: "Paragraph", icon: "i-lucide:pilcrow" },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({
    name: "heading",
    label: `Heading ${level}`,
    icon: `i-lucide:heading-${level}`,
    level
  })),
  { name: "blockquote", label: "Blockquote", icon: "i-lucide:text-quote" }
];
const getSelectedBlock = (editor: Editor) => {
  const { doc, selection } = editor.state;
  const node = doc.nodeAt(selection.from);

  if (
    !editor.isEditable ||
    !isBlockSelection(selection) ||
    selection.ranges.length !== 1 ||
    !node ||
    selection.to !== selection.from + node.nodeSize ||
    (selection.$from.parent !== doc && selection.$from.parent.type.name !== "fragment") ||
    isPositionInInheritedField(doc, selection.from)
  ) {
    return null;
  }

  return { node, selection };
};
const getConvertedContent = (
  editor: Editor,
  node: ProseMirrorNode,
  option: ConversionOption
): Fragment | null => {
  const type = editor.schema.nodes[option.name];
  const children: ProseMirrorNode[] = [];

  if (!type) return null;

  if (listOptions.some(({ name }) => name === node.type.name)) {
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
        ? type.create({ ...child.attrs, level: option.level }, child.content, child.marks)
        : child
    );
  });

  return children.every((child) => child.type.validContent(child.content))
    ? Fragment.from(children)
    : null;
};
const createTurnIntoMenuItem = (editor: Editor): NonNullable<MenuItem["items"]> => {
  const block = getSelectedBlock(editor);

  if (!block) return [];

  const { node, selection } = block;
  const options = listOptions.some(({ name }) => name === node.type.name)
    ? listOptions
    : textOptions.some(({ name }) => name === node.type.name)
      ? textOptions
      : [];
  const items = options.flatMap((option): MenuItem[] => {
    const selected =
      node.type.name === option.name && (!option.level || node.attrs.level === option.level);
    const content = selected ? Fragment.from(node) : getConvertedContent(editor, node, option);
    const parent = selection.$from.parent;
    const allowedBlocks = parent.type.name === "fragment" ? parent.attrs.allowedBlocks : null;
    const enabledLevels = editor.extensionManager.extensions.find(({ name }) => name === "heading")
      ?.options.enabledLevels;

    if (option.level && enabledLevels && !enabledLevels.includes(option.level)) return [];
    if (!content || !parent.canReplace(selection.$from.index(), selection.$to.index(), content))
      return [];

    let allowed = true;

    content.forEach((child) => {
      if (
        Array.isArray(allowedBlocks) &&
        child.type.name !== "paragraph" &&
        !allowedBlocks.includes(child.type.name)
      ) {
        allowed = false;
      }
    });

    if (!allowed) return [];

    return [
      {
        label: option.label,
        icon: option.icon,
        selected,
        onClick: () => {
          if (selected || editor.isDestroyed) return;

          const current = getSelectedBlock(editor);

          if (!current || current.node !== node || !current.selection.eq(selection)) return;

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

  return items.length > 1 ? [{ label: "Turn into", icon: "i-lucide:repeat", items }] : [];
};

export { createTurnIntoMenuItem };
