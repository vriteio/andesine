import {
  type ContentNode,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  Text,
  useEditor
} from "@andesine/extensions/solid";

interface BlockActionProps {
  blocks: ContentNode[];
}

const countWords = (node: ContentNode): number => {
  const own = node.text?.split(/\s+/).filter(Boolean).length ?? 0;

  return own + (node.content ?? []).reduce((total, child) => total + countWords(child), 0);
};

/**
 * A block action menu where the block menu was: a custom item with the count and a structured
 * item. Escape or a click outside closes it; after a choice, the action runs until it closes.
 */
export const CountWordsAction = (props: BlockActionProps) => {
  const editor = useEditor();
  const words = () => props.blocks.reduce((total, block) => total + countWords(block), 0);
  const insert = async () => {
    await editor.insertAfter([
      { type: "paragraph", content: [{ type: "text", text: `${words()} words.` }] }
    ]);
    await editor.close();
  };

  return (
    <Menu size="medium">
      <MenuContent>
        <Text size="sm" tone="muted" class="px-2 py-1">
          {words()} words
        </Text>
      </MenuContent>
      <MenuSeparator />
      <MenuItem label="Insert below" icon="i-lucide:list-plus" onSelect={insert} />
    </Menu>
  );
};
