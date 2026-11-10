import type { ContentNode } from "@andesine/converters";

interface FragmentSource {
  content: unknown;
  fragments: Record<string, { name?: string; content: unknown } | undefined>;
}

interface EntryFragments {
  body: ContentNode;
  summary?: ContentNode;
  aside?: ContentNode;
}

type SlotName = "summary" | "aside";

const slotNames: SlotName[] = ["summary", "aside"];
const contentTypes = new Set(["image", "element", "horizontalRule", "codeBlock", "table"]);

/** Empty fragments have only empty paragraphs. */
const hasContent = (node: ContentNode): boolean => {
  return (
    Boolean(node.text?.trim()) ||
    contentTypes.has(node.type) ||
    (node.content ?? []).some(hasContent)
  );
};
/**
 * Splits an entry into the page body and the `summary` and `aside` fragments, which the layout
 * shows in their own places. Other named fragments stay in the body.
 */
const splitFragments = (entry: FragmentSource): EntryFragments => {
  const document = entry.content as ContentNode;
  const slots = slotNames.flatMap((name) => {
    const fragment = entry.fragments[name];

    return fragment
      ? [{ name, label: fragment.name, content: fragment.content as ContentNode }]
      : [];
  });
  const labels = new Set(slots.map((slot) => slot.label));
  const isSlot = (node: ContentNode): boolean => {
    return node.type === "fragment" && labels.has(String(node.attrs?.name));
  };
  const result: EntryFragments = {
    body: { ...document, content: (document.content ?? []).filter((node) => !isSlot(node)) }
  };

  for (const slot of slots) {
    if (hasContent(slot.content)) result[slot.name] = slot.content;
  }

  return result;
};

export { splitFragments };
export type { EntryFragments };
