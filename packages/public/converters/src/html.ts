import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import type { Element, ElementContent, Properties, Root, RootContent } from "hast";
import { createConverter } from "./core";
import { paragraphContent } from "./markdown/decode";
import { ConversionError, lookup, element, textContent, textNode, withMark } from "./utils";
import type { ConverterOptions, FormatAdapter } from "./types";

type HTMLNode = Root | RootContent;
type HTMLOptions = ConverterOptions<HTMLNode>;

const tag = (tagName: string, children: HTMLNode[] = [], properties: Properties = {}): Element => ({
  type: "element",
  tagName,
  properties,
  children: children as ElementContent[]
});
const htmlText = (node: HTMLNode): string =>
  node.type === "text"
    ? node.value
    : "children" in node
      ? node.children.map(htmlText).join("")
      : "";
const safeURL = (value: string, image = false): string => {
  const url = new URL(value, "https://example.com");
  const allowed = image ? ["http:", "https:"] : ["http:", "https:", "mailto:", "tel:"];

  if (!allowed.includes(url.protocol))
    throw new ConversionError(`Unsupported URL protocol: ${url.protocol}`);

  return value;
};
const htmlMarks: Record<string, string> = {
  strong: "bold",
  b: "bold",
  em: "italic",
  i: "italic",
  s: "strike",
  del: "strike",
  code: "code",
  a: "link",
  sub: "subscript",
  sup: "superscript",
  mark: "highlight"
};
/** HTML adapter for createConverter(), including its parser and node/mark mappings. */
const htmlAdapter: FormatAdapter<HTMLNode> = {
  name: "HTML",
  type: (node) => (node.type === "element" ? node.tagName : node.type),
  elementName: (node) =>
    node.type === "element"
      ? String(node.properties.dataAndesineElement || node.tagName)
      : undefined,
  markName: (node) => (node.type === "element" ? lookup(htmlMarks, node.tagName) : undefined),
  root: (children) => ({ type: "root", children: children as RootContent[] }),
  parse: (source) => fromHtml(source, { fragment: true }),
  stringify: (tree) => toHtml(tree),
  async encode(node, context) {
    const attrs = node.attrs || {};
    const children = await context.children(node);

    switch (node.type) {
      case "text":
        return { type: "text", value: node.text || "" };
      case "paragraph":
        return tag("p", children);
      case "heading":
        return tag(
          `h${Math.max(1, Math.min(6, Number(attrs.level || 1)))}`,
          children,
          context.anchor ? { id: context.anchor } : {}
        );
      case "blockquote":
        return tag("blockquote", children);
      case "bulletList":
        return tag("ul", children);
      case "orderedList":
        return tag("ol", children, { start: Number(attrs.start || 1) });
      case "taskList":
        return tag("ul", children, { dataType: "taskList" });
      case "listItem":
        return tag("li", children);
      case "taskItem":
        return tag("li", children, {
          dataType: "taskItem",
          dataChecked: Boolean(attrs.checked) ? "true" : "false"
        });
      case "hardBreak":
        return tag("br");
      case "horizontalRule":
        return tag("hr");
      case "codeBlock":
        return tag("pre", [
          tag("code", [{ type: "text", value: textContent(node) }], {
            dataLanguage: String(attrs.language || "")
          })
        ]);
      case "image": {
        const image = tag("img", [], {
          src: safeURL(await context.imageURL(node), true),
          alt: String(attrs.alt || "")
        });

        return attrs.caption
          ? tag("figure", [
              image,
              tag("figcaption", [{ type: "text", value: String(attrs.caption) }])
            ])
          : image;
      }
      case "table":
        return tag("table", [tag("tbody", children)]);
      case "tableRow":
        return tag("tr", children);
      case "tableCell":
      case "tableHeader":
        return tag(node.type === "tableHeader" ? "th" : "td", children, {
          colSpan: Number(attrs.colspan || 1),
          rowSpan: Number(attrs.rowspan || 1)
        });
      case "element":
        return tag("div", children, {
          dataAndesineElement: String(attrs.name || "Element"),
          dataAndesineProps: JSON.stringify(attrs.props || {})
        });
      default:
        throw new ConversionError(`Unsupported HTML node: ${node.type}`, context.path);
    }
  },
  mark(mark, children, context) {
    const name = Object.entries(htmlMarks).find(([, type]) => type === mark.type)?.[0];

    if (!name) throw new ConversionError(`Unsupported HTML mark: ${mark.type}`, context.path);

    return tag(
      name,
      children,
      mark.type === "link" ? { href: safeURL(String(mark.attrs?.href || "")) } : {}
    );
  },
  async decode(node, context) {
    if (node.type === "text") return textNode(node.value.replace(/[ \t\r\n\f]+/g, " "));
    if (node.type !== "root" && node.type !== "element")
      throw new ConversionError(`Unsupported HTML syntax: ${node.type}`, context.path);

    const name = node.type === "element" ? node.tagName : "root";
    const props = node.type === "element" ? node.properties : {};

    if (name === "pre") {
      const code = node.children.find(
        (child) => child.type === "element" && child.tagName === "code"
      );
      const language =
        code?.type === "element"
          ? code.properties.dataLanguage ||
            String(code.properties.className || "").match(/language-([\w+-]+)/)?.[1]
          : undefined;

      return {
        type: "codeBlock",
        attrs: { language: language || null },
        content: textNode(htmlText(node))
      };
    }
    if (name === "img")
      return context.image({
        url: safeURL(String(props.src || ""), true),
        alt: String(props.alt || ""),
        title: props.title ? String(props.title) : undefined
      });
    if (name === "figure") {
      const image = node.children.find(
        (child) => child.type === "element" && child.tagName === "img"
      );
      const caption = node.children.find(
        (child) => child.type === "element" && child.tagName === "figcaption"
      );

      if (!image || image.type !== "element")
        throw new ConversionError("HTML figures require an image", context.path);

      return context.image({
        url: safeURL(String(image.properties.src || ""), true),
        alt: String(image.properties.alt || ""),
        title: caption ? htmlText(caption) : undefined
      });
    }
    const blockContainer = [
      "root",
      "div",
      "section",
      "article",
      "main",
      "ul",
      "ol",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "blockquote"
    ].includes(name);
    const decoded = await context.children(node.children);
    const children = blockContainer
      ? decoded.filter((child, index) => {
          if (child.type !== "text" || /[^ \t\r\n\f]/.test(child.text || "")) return true;

          // Keep word separators inside inline runs, but omit indentation around blocks.
          return [decoded[index - 1], decoded[index + 1]].every(
            (sibling) => sibling && ["text", "hardBreak"].includes(sibling.type)
          );
        })
      : decoded;
    const mark = lookup(htmlMarks, name);

    if (props.dataAndesineElement) {
      return element(
        String(props.dataAndesineElement),
        JSON.parse(String(props.dataAndesineProps || "{}")),
        children
      );
    }
    if (mark)
      return withMark(children, {
        type: mark,
        ...(mark === "link" ? { attrs: { href: safeURL(String(props.href || "")) } } : {})
      });
    if (/^h[1-6]$/.test(name))
      return { type: "heading", attrs: { level: Number(name[1]) }, content: children };

    switch (name) {
      case "root":
      case "div":
      case "section":
      case "article":
      case "main":
        return paragraphContent(children);
      case "thead":
      case "tbody":
      case "tfoot":
        return children;
      case "p":
        return paragraphContent(children);
      case "blockquote":
        return { type: "blockquote", content: paragraphContent(children) };
      case "ul":
      case "ol":
        return {
          type:
            name === "ol"
              ? "orderedList"
              : props.dataType === "taskList"
                ? "taskList"
                : "bulletList",
          ...(name === "ol" ? { attrs: { start: Number(props.start || 1) } } : {}),
          content: children
        };
      case "li":
        return {
          type: props.dataType === "taskItem" ? "taskItem" : "listItem",
          ...(props.dataType === "taskItem"
            ? { attrs: { checked: props.dataChecked === "true" } }
            : {}),
          content: paragraphContent(children)
        };
      case "br":
        return { type: "hardBreak" };
      case "hr":
        return { type: "horizontalRule" };
      case "table":
        return { type: "table", content: children };
      case "tr":
        return { type: "tableRow", content: children };
      case "th":
      case "td":
        return {
          type: name === "th" ? "tableHeader" : "tableCell",
          attrs: { colspan: Number(props.colSpan || 1), rowspan: Number(props.rowSpan || 1) },
          content: paragraphContent(children)
        };
      default:
        throw new ConversionError(`Unsupported HTML element: ${name}`, context.path);
    }
  }
};
/**
 * Create a reusable async HTML converter with application-specific defaults.
 * @param options - Default mappings and handlers; per-call maps merge by key and callbacks may be async.
 * @returns String and AST import/export methods. Defaults use an H1 title, unwrap fragments, and omit properties.
 * Custom elements use Andesine data attributes; frontmatter mappings are not supported.
 */
const createHTMLConverter = (options?: HTMLOptions) => createConverter(htmlAdapter, options);
const converter = createHTMLConverter();
/**
 * Export ProseMirror JSON as HTML.
 * @param document - Entry or fragment document. Fragment wrappers are removed by default.
 * @param options - Title/property/fragment mappings and async handlers; imageURL resolves images.
 * @returns Serialized HTML. Omitted metadata and unwrapped fragment boundaries are not recoverable.
 * @throws ConversionError for unsupported content, unresolved images, or invalid mappings; handler errors pass through.
 */
const toHTML = converter.encode;
/**
 * Import HTML as ProseMirror JSON without saving content or uploading assets.
 * @param source - Source text to parse. Custom elements use Andesine data attributes; frontmatter mappings are not supported.
 * @param options - Import mappings and async handlers. imageAssetID must resolve image URLs.
 * @returns An entry document; use document: "fragment" to omit the title and retain the first H1 as body content.
 * @throws ConversionError for unsupported content/mappings; parser and handler errors pass through.
 */
const fromHTML = converter.decode;
/**
 * Export ProseMirror JSON as a HTML AST with separate frontmatter.
 * @param document - Source entry or fragment document.
 * @param options - Export mappings and async handlers, including imageURL for images.
 * @returns The format tree and metadata without string serialization.
 * @throws The same conversion errors as toHTML(), including unsupported frontmatter mappings.
 */
const toHTMLAST = converter.toAST;
/**
 * Import a parsed HTML AST and its frontmatter as ProseMirror JSON.
 * @param input - Tree and frontmatter object; use an empty object when metadata is absent.
 * @param options - Import mappings and async handlers, including imageAssetID for images.
 * @returns An entry document by default, or a fragment document when requested.
 * @throws The same conversion errors as fromHTML(), excluding string-parser errors.
 */
const fromHTMLAST = converter.fromAST;

export { createHTMLConverter, htmlAdapter, toHTML, fromHTML, toHTMLAST, fromHTMLAST };
export type { HTMLNode, HTMLOptions };
