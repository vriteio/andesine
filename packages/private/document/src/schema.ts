const MAX_PROPERTY_NAME_LENGTH = 50;
const MAX_FRAGMENT_NAME_LENGTH = 50;
const FRAGMENT_BLOCK_TYPES = [
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "horizontalRule",
  "codeBlock",
  "table",
  "element",
  "image"
] as const;

type FragmentBlockType = (typeof FRAGMENT_BLOCK_TYPES)[number];

const MAX_ENTRY_TITLE_LENGTH = 300;
const normalizeEntryTitle = (title: string) => title.normalize("NFC").trim() || "Untitled";

export {
  MAX_PROPERTY_NAME_LENGTH,
  MAX_FRAGMENT_NAME_LENGTH,
  MAX_ENTRY_TITLE_LENGTH,
  FRAGMENT_BLOCK_TYPES,
  normalizeEntryTitle
};
export type { FragmentBlockType };
