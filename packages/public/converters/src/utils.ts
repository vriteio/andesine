import type { ContentMark, ContentNode, HandlerResult } from "./types";

/** A conversion failure, optionally located at a child-index path in the source tree. */
class ConversionError extends Error {
  /**
   * @param message - Description of the unsupported content or invalid mapping.
   * @param path - Child indexes appended to the message; defaults to the document root.
   */
  constructor(
    message: string,
    readonly path: readonly number[] = []
  ) {
    super(`${message}${path.length ? ` at content[${path.join("][")}]` : ""}`);
    this.name = "ConversionError";
  }
}

const lookup = <T>(record: Record<string, T> | undefined, name: string): T | undefined => {
  return record && Object.hasOwn(record, name) ? record[name] : undefined;
};
const array = <T>(value: HandlerResult<T>): T[] =>
  value === null ? [] : Array.isArray(value) ? value : [value];
/**
 * Concatenate a node's descendant text without changing the source.
 * @param node - ProseMirror node to read.
 * @returns Raw text with no added block separators, markup, or hard-break replacement.
 */
const textContent = (node: ContentNode): string =>
  node.text ?? (node.content || []).map(textContent).join("");
/**
 * Create text content suitable for a node handler.
 * @param text - Literal text to include.
 * @returns One text node, or an empty array for an empty string.
 */
const textNode = (text: string): ContentNode[] => (text ? [{ type: "text", text }] : []);
/**
 * Append a mark to all descendant text nodes without modifying the input nodes.
 * @param nodes - Content to mark. Existing marks are retained, including duplicates.
 * @param mark - Mark to append to each text node.
 * @returns Mapped nodes; unchanged leaf nodes and existing marks may retain their references.
 */
const withMark = (nodes: ContentNode[], mark: ContentMark): ContentNode[] =>
  nodes.map((node) => {
    if (node.type === "text") return { ...node, marks: [...(node.marks || []), mark] };

    return node.content ? { ...node, content: withMark(node.content, mark) } : node;
  });
const isJSONValue = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJSONValue);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;

  return Object.values(value).every(isJSONValue);
};
/**
 * Create an Andesine element node with static JSON properties and a source representation.
 * @param name - Element name, starting with a letter and containing letters, digits, _, ., or -.
 * @param props - Static JSON properties with valid attribute names; executable expressions are rejected.
 * @param content - Child nodes. The supplied content array is retained.
 * @param selfClosing - Whether the source uses a self-closing tag; defaults to true for empty content.
 * @returns A ProseMirror element node for use in import handlers.
 * @throws ConversionError for invalid names, property keys, or non-JSON property values.
 */
const element = (
  name: string,
  props: Record<string, unknown>,
  content: ContentNode[],
  selfClosing = !content.length
): ContentNode => {
  if (!/^[A-Za-z][\w.-]*$/.test(name) || !isJSONValue(props)) {
    throw new ConversionError("Elements require a valid name and static JSON properties");
  }
  const attributes = Object.entries(props)
    .map(([key, value]) => {
      if (!/^[A-Za-z][\w-]*$/.test(key))
        throw new ConversionError(`Invalid element property: ${key}`);

      return typeof value === "string"
        ? ` ${key}=${JSON.stringify(value)}`
        : ` ${key}={${JSON.stringify(value)}}`;
    })
    .join("");

  return {
    type: "element",
    attrs: { name, props, selfClosing, source: `<${name}${attributes}${selfClosing ? " /" : ""}>` },
    ...(content.length ? { content } : {})
  };
};

export { ConversionError, lookup, array, element, isJSONValue, textContent, textNode, withMark };
