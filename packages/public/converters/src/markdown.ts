import { createConverter } from "./core";
import { createMarkdownAdapter } from "./markdown/adapter";
import type { ConverterOptions } from "./types";
import type { MarkdownNode } from "./markdown/decode";

type MarkdownOptions = ConverterOptions<MarkdownNode>;

/** Markdown/GFM adapter for createConverter(), including its parser and node/mark mappings. */
const markdownAdapter = createMarkdownAdapter();
/**
 * Create a reusable async Markdown/GFM converter with application-specific defaults.
 * @param options - Default mappings and handlers; per-call maps merge by key and callbacks may be async.
 * @returns String and AST import/export methods. Defaults use an H1 title, unwrap fragments, and omit properties.
 * Markdown cannot preserve custom elements without handlers.
 */
const createMarkdownConverter = (options?: MarkdownOptions) =>
  createConverter(markdownAdapter, options);
const converter = createMarkdownConverter();
/**
 * Export ProseMirror JSON as Markdown/GFM.
 * @param document - Entry or fragment document. Fragment wrappers are removed by default.
 * @param options - Title/property/fragment mappings and async handlers; imageURL resolves images.
 * @returns Serialized Markdown/GFM. Omitted metadata and unwrapped fragment boundaries are not recoverable.
 * @throws ConversionError for unsupported content, unresolved images, or invalid mappings; handler errors pass through.
 */
const toMarkdown = converter.encode;
/**
 * Import Markdown/GFM as ProseMirror JSON without saving content or uploading assets.
 * @param source - Source text to parse. Markdown cannot preserve custom elements without handlers.
 * @param options - Import mappings and async handlers. imageAssetID must resolve image URLs.
 * @returns An entry document; use document: "fragment" to omit the title and retain the first H1 as body content.
 * @throws ConversionError for unsupported content/mappings; parser and handler errors pass through.
 */
const fromMarkdown = converter.decode;
/**
 * Export ProseMirror JSON as a Markdown/GFM AST with separate frontmatter.
 * @param document - Source entry or fragment document.
 * @param options - Export mappings and async handlers, including imageURL for images.
 * @returns The format tree and metadata without string serialization.
 * @throws The same conversion errors as toMarkdown(), including unsupported frontmatter mappings.
 */
const toMarkdownAST = converter.toAST;
/**
 * Import a parsed Markdown/GFM AST and its frontmatter as ProseMirror JSON.
 * @param input - Tree and frontmatter object; use an empty object when metadata is absent.
 * @param options - Import mappings and async handlers, including imageAssetID for images.
 * @returns An entry document by default, or a fragment document when requested.
 * @throws The same conversion errors as fromMarkdown(), excluding string-parser errors.
 */
const fromMarkdownAST = converter.fromAST;

export {
  createMarkdownConverter,
  markdownAdapter,
  toMarkdown,
  fromMarkdown,
  toMarkdownAST,
  fromMarkdownAST
};
export type { MarkdownOptions, MarkdownNode };
