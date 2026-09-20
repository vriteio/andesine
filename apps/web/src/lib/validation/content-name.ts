import type { Collection, Entry } from "#web/lib/api";

interface ContentNameInput {
  id?: string;
  parentID?: string | null;
  kind: "entry" | "collection";
  name: string;
}
interface ContentNameTree {
  entries: Entry[];
  collections: Collection[];
}

const MAX_CONTENT_NAME_LENGTH = 300;
const normalizeEntryName = (name: string) => name.normalize("NFC").trim() || "Untitled";
const normalizeCollectionName = (name: string) => name.normalize("NFC").trim();
const getSiblingContentNames = (tree: ContentNameTree, input: ContentNameInput): Set<string> => {
  const rootID = tree.collections.find((item) => item.name === "~" && !item.ancestors.length)?.id;
  const level = (parentID?: string | null) => (parentID === rootID ? null : parentID || null);
  const parentID = level(input.parentID);
  const siblings = [
    ...tree.entries.filter(
      (item) =>
        level(item.collectionID) === parentID && (input.kind !== "entry" || item.id !== input.id)
    ),
    ...tree.collections.filter(
      (item) =>
        item.id !== rootID &&
        level(item.ancestors.at(-1)) === parentID &&
        (input.kind !== "collection" || item.id !== input.id)
    )
  ];

  return new Set(siblings.map((item) => item.name.normalize("NFC").trim()));
};
const getContentNameError = (
  tree: ContentNameTree,
  input: ContentNameInput
): string | undefined => {
  const name =
    input.kind === "entry" ? normalizeEntryName(input.name) : normalizeCollectionName(input.name);

  if (!name) {
    return "Collection name cannot be empty";
  }

  if (name.length > MAX_CONTENT_NAME_LENGTH) {
    return `Name cannot exceed ${MAX_CONTENT_NAME_LENGTH} characters`;
  }

  if (name.includes("/") || name === "." || name === "..") {
    return "Name cannot contain / or be . or ..";
  }

  if (input.kind === "collection" && name === "~") {
    return "The name ~ is reserved for the workspace root";
  }

  if (getSiblingContentNames(tree, input).has(name)) {
    return "An entry or collection already uses this name at this level";
  }
};
const getAvailableContentName = (tree: ContentNameTree, input: ContentNameInput): string => {
  const names = getSiblingContentNames(tree, input);

  let name = input.name;
  let number = 2;

  while (names.has(name)) {
    const suffix = ` (${number})`;

    let prefix = "";

    for (const character of input.name) {
      if (prefix.length + character.length > MAX_CONTENT_NAME_LENGTH - suffix.length) break;
      prefix += character;
    }

    name = `${prefix}${suffix}`;
    number += 1;
  }

  return name;
};

export {
  MAX_CONTENT_NAME_LENGTH,
  normalizeCollectionName,
  normalizeEntryName,
  getContentNameError,
  getAvailableContentName
};
export type { ContentNameInput };
