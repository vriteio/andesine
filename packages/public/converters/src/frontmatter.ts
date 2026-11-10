import { parseDocument, stringify } from "yaml";
import { ConversionError, isJSONValue } from "./utils";

const readFrontmatter = (
  source: string
): { source: string; frontmatter: Record<string, unknown> } => {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);

  if (!match) return { source, frontmatter: {} };

  const document = parseDocument(match[1], { schema: "core", uniqueKeys: true });

  if (document.errors.length)
    throw new ConversionError(`Invalid frontmatter: ${document.errors[0].message}`);

  const value: unknown = document.toJS({ maxAliasCount: 100 });

  if (!value || Array.isArray(value) || typeof value !== "object" || !isJSONValue(value)) {
    throw new ConversionError("Frontmatter must contain an object with static JSON values");
  }
  return { source: source.slice(match[0].length), frontmatter: value as Record<string, unknown> };
};
const writeFrontmatter = (frontmatter: Record<string, unknown>, source: string): string => {
  return Object.keys(frontmatter).length
    ? `---\n${stringify(frontmatter)}---\n\n${source}`
    : source;
};

export { readFrontmatter, writeFrontmatter };
