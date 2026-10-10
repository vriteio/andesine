import { type ContentNode, useEditor } from "@andesine/extensions/solid";
import { onMount } from "solid-js";

interface BlockActionProps {
  /** The selected blocks as editor JSON. */
  blocks: ContentNode[];
}

const shout = (node: ContentNode): ContentNode => {
  return {
    ...node,
    ...(node.text !== undefined && { text: node.text.toUpperCase() }),
    ...(node.content && { content: node.content.map(shout) })
  };
};

/**
 * A block action without UI: it renders nothing, so the block menu shows a spinner until it
 * closes. Andesine shows an error if the edit fails.
 */
export const ShoutAction = (props: BlockActionProps) => {
  const editor = useEditor();

  onMount(async () => {
    try {
      await editor.replace(props.blocks.map(shout));
    } finally {
      await editor.close();
    }
  });

  return null;
};
