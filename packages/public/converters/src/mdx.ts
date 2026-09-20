import remarkMDX from "remark-mdx";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { createConverter } from "./core";
import { createMarkdownAdapter } from "./markdown/adapter";
import { element, isJSONValue, ConversionError } from "./utils";
import { staticExpression } from "./static-expression";
import type { MarkdownNode } from "./markdown/decode";
import type { ConverterOptions, FormatAdapter } from "./types";

type MDXNode = MarkdownNode | MdxJsxFlowElement;
type MDXOptions = ConverterOptions<MDXNode>;

const markdown = createMarkdownAdapter(remarkMDX);
/** MDX adapter for createConverter(), including its parser and node/mark mappings. */
const mdxAdapter: FormatAdapter<MDXNode> = {
  ...markdown,
  elementName: (node) =>
    node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement"
      ? node.name || undefined
      : undefined,
  async encode(node, context) {
    if (node.type !== "element") return markdown.encode(node, context);

    const name = String(node.attrs?.name || "Element");
    const props = (node.attrs?.props || {}) as Record<string, unknown>;
    const children = await context.children(node);

    if (!isJSONValue(props))
      throw new ConversionError("MDX element properties must be static JSON values", context.path);

    // Validate names and build a source form using the same static element rules.
    element(name, props, []);
    return {
      type: "mdxJsxFlowElement",
      name,
      attributes: Object.entries(props).map(([name, value]) => ({
        type: "mdxJsxAttribute",
        name,
        value:
          typeof value === "string"
            ? value
            : { type: "mdxJsxAttributeValueExpression", value: JSON.stringify(value) }
      })),
      children
    } as Extract<MarkdownNode, { type: "mdxJsxFlowElement" }>;
  },
  async decode(node, context) {
    if (node.type !== "mdxJsxFlowElement") return markdown.decode(node, context);
    if (!node.name)
      throw new ConversionError("MDX fragments require a custom handler", context.path);

    const props: Record<string, unknown> = Object.create(null);

    for (const attribute of node.attributes) {
      if (attribute.type !== "mdxJsxAttribute")
        throw new ConversionError("MDX spread attributes require a custom handler", context.path);

      props[attribute.name] =
        attribute.value === null || attribute.value === undefined
          ? true
          : typeof attribute.value === "string"
            ? attribute.value
            : staticExpression(attribute.value.value);
    }
    return element(node.name, { ...props }, await context.children(node.children));
  }
};
/**
 * Create a reusable async MDX converter with application-specific defaults.
 * @param options - Default mappings and handlers; per-call maps merge by key and callbacks may be async.
 * @returns String and AST import/export methods. Defaults use an H1 title, unwrap fragments, and omit properties.
 * Custom elements use static JSON properties; executable expressions require custom handlers.
 */
const createMDXConverter = (options?: MDXOptions) => createConverter(mdxAdapter, options);
const converter = createMDXConverter();
/**
 * Export ProseMirror JSON as MDX.
 * @param document - Entry or fragment document. Fragment wrappers are removed by default.
 * @param options - Title/property/fragment mappings and async handlers; imageURL resolves images.
 * @returns Serialized MDX. Omitted metadata and unwrapped fragment boundaries are not recoverable.
 * @throws ConversionError for unsupported content, unresolved images, or invalid mappings; handler errors pass through.
 */
const toMDX = converter.encode;
/**
 * Import MDX as ProseMirror JSON without saving content or uploading assets.
 * @param source - Source text to parse. Custom elements use static JSON properties; executable expressions require custom handlers.
 * @param options - Import mappings and async handlers. imageAssetID must resolve image URLs.
 * @returns An entry document; use document: "fragment" to omit the title and retain the first H1 as body content.
 * @throws ConversionError for unsupported content/mappings; parser and handler errors pass through.
 */
const fromMDX = converter.decode;
/**
 * Export ProseMirror JSON as a MDX AST with separate frontmatter.
 * @param document - Source entry or fragment document.
 * @param options - Export mappings and async handlers, including imageURL for images.
 * @returns The format tree and metadata without string serialization.
 * @throws The same conversion errors as toMDX(), including unsupported frontmatter mappings.
 */
const toMDXAST = converter.toAST;
/**
 * Import a parsed MDX AST and its frontmatter as ProseMirror JSON.
 * @param input - Tree and frontmatter object; use an empty object when metadata is absent.
 * @param options - Import mappings and async handlers, including imageAssetID for images.
 * @returns An entry document by default, or a fragment document when requested.
 * @throws The same conversion errors as fromMDX(), excluding string-parser errors.
 */
const fromMDXAST = converter.fromAST;

export { createMDXConverter, mdxAdapter, toMDX, fromMDX, toMDXAST, fromMDXAST };
export type { MDXOptions, MDXNode };
