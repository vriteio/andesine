import Markdoc from "@markdoc/markdoc";
import { serializeMarkdoc } from "./markdoc/serialize";
import { createConverter } from "./core";
import {
  ConversionError,
  lookup,
  element,
  isJSONValue,
  textContent,
  textNode,
  withMark
} from "./utils";
import { paragraphContent } from "./markdown/decode";
import type { ConverterOptions, FormatAdapter } from "./types";

type MarkdocNode = InstanceType<typeof Markdoc.Ast.Node>;
type MarkdocOptions = ConverterOptions<MarkdocNode>;

const markTypes: Record<string, string> = {
  bold: "strong",
  italic: "em",
  strike: "s",
  code: "code",
  link: "link"
};
/** Markdoc adapter for createConverter(), including its parser and node/mark mappings. */
const markdocAdapter: FormatAdapter<MarkdocNode> = {
  name: "Markdoc",
  frontmatter: true,
  type: (node) => node.type,
  elementName: (node) => (node.type === "tag" ? node.tag : undefined),
  markName: (node) => Object.entries(markTypes).find(([, type]) => type === node.type)?.[0],
  root: (children) => new Markdoc.Ast.Node("document", {}, children),
  parse: (source) => Markdoc.parse(source),
  stringify: serializeMarkdoc,
  async encode(node, context) {
    const attrs = node.attrs || {};
    const children = await context.children(node);
    const inline = () => [new Markdoc.Ast.Node("inline", {}, children)];

    switch (node.type) {
      case "text":
        return new Markdoc.Ast.Node("text", { content: node.text || "" });
      case "paragraph":
        return new Markdoc.Ast.Node("paragraph", {}, inline());
      case "heading":
        return new Markdoc.Ast.Node(
          "heading",
          { level: Number(attrs.level || 1), ...(context.anchor ? { id: context.anchor } : {}) },
          inline()
        );
      case "blockquote":
        return new Markdoc.Ast.Node("blockquote", {}, children);
      case "bulletList":
      case "orderedList":
        return new Markdoc.Ast.Node(
          "list",
          {
            ordered: node.type === "orderedList",
            start: attrs.start || 1,
            marker: node.type === "orderedList" ? "." : "-"
          },
          children
        );
      case "listItem":
        return new Markdoc.Ast.Node("item", {}, children);
      case "codeBlock":
        return new Markdoc.Ast.Node("fence", {
          language: attrs.language || "",
          content: textContent(node)
        });
      case "hardBreak":
        return new Markdoc.Ast.Node("hardbreak");
      case "horizontalRule":
        return new Markdoc.Ast.Node("hr");
      case "image":
        return new Markdoc.Ast.Node("paragraph", {}, [
          new Markdoc.Ast.Node("inline", {}, [
            new Markdoc.Ast.Node("image", {
              src: await context.imageURL(node),
              alt: String(attrs.alt || ""),
              title: String(attrs.caption || "")
            })
          ])
        ]);
      case "element": {
        const props = (attrs.props || {}) as Record<string, unknown>;

        if (!isJSONValue(props))
          throw new ConversionError(
            "Markdoc attributes must contain static JSON values",
            context.path
          );

        return new Markdoc.Ast.Node("tag", props, children, String(attrs.name || "Element"));
      }
      case "table":
        return new Markdoc.Ast.Node(
          "table",
          {},
          children.length
            ? [
                new Markdoc.Ast.Node("thead", {}, children.slice(0, 1)),
                new Markdoc.Ast.Node("tbody", {}, children.slice(1))
              ]
            : []
        );
      case "tableRow":
        return new Markdoc.Ast.Node("tr", {}, children);
      case "tableCell":
      case "tableHeader": {
        if (
          Number(attrs.colspan || 1) !== 1 ||
          Number(attrs.rowspan || 1) !== 1 ||
          children.length > 1 ||
          children.some((child) => child.type !== "paragraph")
        ) {
          throw new ConversionError(
            "Markdoc tables require single-paragraph cells without spans",
            context.path
          );
        }
        return new Markdoc.Ast.Node(
          node.type === "tableHeader" ? "th" : "td",
          {},
          children.flatMap((child) => child.children)
        );
      }
      default:
        throw new ConversionError(`Unsupported Markdoc node: ${node.type}`, context.path);
    }
  },
  mark(mark, children, context) {
    const type = lookup(markTypes, mark.type);

    if (!type) throw new ConversionError(`Unsupported Markdoc mark: ${mark.type}`, context.path);
    if (mark.type === "code") {
      if (children.some((node) => node.type !== "text"))
        throw new ConversionError("Code marks must wrap plain text", context.path);

      return new Markdoc.Ast.Node("code", {
        content: children.map((node) => node.attributes.content).join("")
      });
    }
    return new Markdoc.Ast.Node(
      type as MarkdocNode["type"],
      mark.type === "link" ? { href: mark.attrs?.href || "" } : {},
      children
    );
  },
  async decode(node, context) {
    const attrs = node.attributes;

    if (node.errors.length)
      throw new ConversionError(`Invalid Markdoc: ${node.errors[0].message}`, context.path);
    if (!isJSONValue(attrs))
      throw new ConversionError(
        "Dynamic Markdoc attributes require a custom handler",
        context.path
      );

    const children = await context.children(node.children);
    const mark = Object.entries(markTypes).find(([, type]) => type === node.type)?.[0];

    if (mark === "code") return withMark(textNode(String(attrs.content || "")), { type: "code" });
    if (mark)
      return withMark(children, {
        type: mark,
        ...(mark === "link" ? { attrs: { href: attrs.href } } : {})
      });

    switch (node.type) {
      case "document":
      case "inline":
      case "thead":
      case "tbody":
        return children;
      case "text":
        return textNode(String(attrs.content || ""));
      case "paragraph":
        return paragraphContent(children);
      case "heading":
        return { type: "heading", attrs: { level: attrs.level || 1 }, content: children };
      case "blockquote":
        return { type: "blockquote", content: children };
      case "list":
        return {
          type: attrs.ordered ? "orderedList" : "bulletList",
          ...(attrs.ordered ? { attrs: { start: attrs.start || 1 } } : {}),
          content: children
        };
      case "item":
        return { type: "listItem", content: paragraphContent(children) };
      case "fence":
        return {
          type: "codeBlock",
          attrs: { language: attrs.language || null },
          content: textNode(String(attrs.content || "").replace(/\n$/, ""))
        };
      case "hardbreak":
        return { type: "hardBreak" };
      case "softbreak":
        return textNode("\n");
      case "hr":
        return { type: "horizontalRule" };
      case "image":
        return context.image({
          url: String(attrs.src || ""),
          alt: String(attrs.alt || ""),
          title: attrs.title
        });
      case "tag":
        return element(
          node.tag || "Element",
          attrs,
          children.length ? paragraphContent(children) : []
        );
      case "table":
        return { type: "table", content: children };
      case "tr":
        return { type: "tableRow", content: children };
      case "th":
      case "td":
        return {
          type: node.type === "th" ? "tableHeader" : "tableCell",
          content: paragraphContent(children)
        };
      default:
        throw new ConversionError(`Unsupported Markdoc syntax: ${node.type}`, context.path);
    }
  }
};
/**
 * Create a reusable async Markdoc converter with application-specific defaults.
 * @param options - Default mappings and handlers; per-call maps merge by key and callbacks may be async.
 * @returns String and AST import/export methods. Defaults use an H1 title, unwrap fragments, and omit properties.
 * Custom elements use Markdoc tags with static properties.
 */
const createMarkdocConverter = (options?: MarkdocOptions) =>
  createConverter(markdocAdapter, options);
const converter = createMarkdocConverter();
/**
 * Export ProseMirror JSON as Markdoc.
 * @param document - Entry or fragment document. Fragment wrappers are removed by default.
 * @param options - Title/property/fragment mappings and async handlers; imageURL resolves images.
 * @returns Serialized Markdoc. Omitted metadata and unwrapped fragment boundaries are not recoverable.
 * @throws ConversionError for unsupported content, unresolved images, or invalid mappings; handler errors pass through.
 */
const toMarkdoc = converter.encode;
/**
 * Import Markdoc as ProseMirror JSON without saving content or uploading assets.
 * @param source - Source text to parse. Custom elements use Markdoc tags with static properties.
 * @param options - Import mappings and async handlers. imageAssetID must resolve image URLs.
 * @returns An entry document; use document: "fragment" to omit the title and retain the first H1 as body content.
 * @throws ConversionError for unsupported content/mappings; parser and handler errors pass through.
 */
const fromMarkdoc = converter.decode;
/**
 * Export ProseMirror JSON as a Markdoc AST with separate frontmatter.
 * @param document - Source entry or fragment document.
 * @param options - Export mappings and async handlers, including imageURL for images.
 * @returns The format tree and metadata without string serialization.
 * @throws The same conversion errors as toMarkdoc(), including unsupported frontmatter mappings.
 */
const toMarkdocAST = converter.toAST;
/**
 * Import a parsed Markdoc AST and its frontmatter as ProseMirror JSON.
 * @param input - Tree and frontmatter object; use an empty object when metadata is absent.
 * @param options - Import mappings and async handlers, including imageAssetID for images.
 * @returns An entry document by default, or a fragment document when requested.
 * @throws The same conversion errors as fromMarkdoc(), excluding string-parser errors.
 */
const fromMarkdocAST = converter.fromAST;

export {
  createMarkdocConverter,
  markdocAdapter,
  toMarkdoc,
  fromMarkdoc,
  toMarkdocAST,
  fromMarkdocAST
};
export type { MarkdocNode, MarkdocOptions };
