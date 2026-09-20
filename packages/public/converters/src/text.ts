import { createExportConverter } from "./core";
import { ConversionError, textContent } from "./utils";
import type { ExportConverterOptions, ExportFormatAdapter } from "./types";

interface TextNode {
  type: "text" | "root";
  value?: string;
  children?: TextNode[];
}

type TextOptions = ExportConverterOptions<TextNode>;

const getText = (node: TextNode): string =>
  node.value ?? (node.children || []).map(getText).join("");
/** Export-only plain-text adapter. Formatting is discarded; import methods are not provided. */
const textAdapter: ExportFormatAdapter<TextNode> = {
  name: "Plain text",
  root: (children) => ({ type: "root", children }),
  stringify: (tree) => getText(tree).trimEnd(),
  mark: (_mark, children) => children,
  async encode(node, context) {
    const children = await context.children(node);
    const value = children.map(getText).join("");
    const text = (value: string): TextNode => ({ type: "text", value });

    switch (node.type) {
      case "text":
        return text(node.text || "");
      case "hardBreak":
        return text("\n");
      case "horizontalRule":
        return text("\n\n");
      case "paragraph":
      case "heading":
      case "blockquote":
        return text(`${value.trimEnd()}\n\n`);
      case "codeBlock":
        return text(`${textContent(node)}\n\n`);
      case "image":
        return text(`${String(node.attrs?.alt || node.attrs?.caption || "")}\n\n`);
      case "listItem":
        return text(value.trimEnd());
      case "taskItem":
        return text(`[${node.attrs?.checked ? "x" : " "}] ${value.trimEnd()}`);
      case "bulletList":
      case "orderedList":
      case "taskList":
        return text(
          `${children.map((child, index) => `${node.type === "orderedList" ? `${Number(node.attrs?.start || 1) + index}.` : "-"} ${getText(child).replace(/\n/g, "\n  ")}`).join("\n")}\n\n`
        );
      case "table":
        return text(`${value.trimEnd()}\n\n`);
      case "tableRow":
        return text(`${children.map((child) => getText(child).trimEnd()).join("\t")}\n`);
      case "tableCell":
      case "tableHeader":
        return text(value.trimEnd());
      default:
        throw new ConversionError(`Unsupported plain-text node: ${node.type}`, context.path);
    }
  }
};
/**
 * Create an export-only async plain-text converter with reusable defaults.
 * @param options - Default mappings and handlers, merged with per-call overrides.
 * @returns encode() and toAST(). Import is not supported. Marks and fragment boundaries are lost;
 * images use alt text or captions and do not require an imageURL callback. Frontmatter is unsupported.
 */
const createTextConverter = (options?: TextOptions) => createExportConverter(textAdapter, options);
const converter = createTextConverter();
/**
 * Export a ProseMirror document as plain text.
 * @param document - Entry or fragment document.
 * @param options - Export mappings and async handlers. Properties are omitted by default.
 * @returns Text with block/list separators and image alt text or captions; formatting is discarded.
 * @throws ConversionError for unsupported nodes or frontmatter mappings; handler errors pass through.
 */
const toText = converter.encode;
/**
 * Export a ProseMirror document as a plain-text tree.
 * @param document - Entry or fragment document.
 * @param options - Export mappings and async handlers, with the same limits as toText().
 * @returns A text/root AST and an empty frontmatter object without string serialization.
 * @throws The same conversion errors as toText(); frontmatter mappings remain unsupported.
 */
const toTextAST = converter.toAST;

export { createTextConverter, textAdapter, toText, toTextAST };
export type { TextNode, TextOptions };
