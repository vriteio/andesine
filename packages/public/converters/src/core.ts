import { getHeadingAnchors } from "./anchors";
import { readFrontmatter, writeFrontmatter } from "./frontmatter";
import { array, ConversionError, lookup, textContent, textNode } from "./utils";
import type {
  ContentNode,
  ConvertedAST,
  Converter,
  ConverterOptions,
  DecodeContext,
  EncodeContext,
  ExportConverter,
  ExportConverterOptions,
  ExportFormatAdapter,
  ImportConverter,
  ImportConverterOptions,
  ImportFormatAdapter,
  FormatAdapter
} from "./types";

/**
 * Build an async export-only converter using the shared content mappings.
 *
 * @param adapter - Root builder, serializer, and export node/mark handlers. No import stubs are needed.
 * @param defaults - Reusable options. Per-call handler maps and named fragment mappings merge by key.
 * @returns Only encode() and toAST(), both async. Handlers and image callbacks may be async.
 * Import methods are absent at runtime and in TypeScript. No content is saved.
 * Unsupported nodes and marks are handled by the adapter, usually by throwing ConversionError.
 * Defaults render titles as H1s, unwrap fragments, and omit properties. Removed boundaries and
 * omitted data cannot be recovered on import; choose explicit mappings when preservation matters.
 */
const createExportConverter = <T>(
  adapter: ExportFormatAdapter<T>,
  defaults: ExportConverterOptions<T> = {}
): ExportConverter<T> => {
  const toAST = async (
    document: ContentNode,
    options: ExportConverterOptions<T> = {}
  ): Promise<ConvertedAST<T>> => {
    const settings = mergeOptions(defaults, options);
    const anchors = new Map(
      getHeadingAnchors(document).map((heading) => [heading.path.join("."), heading.anchor])
    );
    const frontmatter: Record<string, unknown> = Object.create(null);
    const encode = async (node: ContentNode, path: readonly number[]): Promise<T[]> => {
      // Code handlers consume plain text, so code must be the innermost mark.
      const marks = [...(node.marks || [])].sort(
        (first, second) => Number(first.type === "code") - Number(second.type === "code")
      );
      const context: EncodeContext<T> = {
        anchor: node.type === "heading" ? anchors.get(path.join(".")) : undefined,
        options: settings,
        path,
        encode: (child) => encode(child, path),
        children: async (parent) => {
          const children: T[] = [];

          for (const [index, child] of (parent.content || []).entries())
            children.push(...(await encode(child, [...path, index])));
          return children;
        },
        imageURL: async (image) => {
          const url = await settings.imageURL?.(image);

          if (!url)
            throw new ConversionError("An imageURL callback must resolve the image asset", path);
          return url;
        }
      };
      const handlers = settings.encode;
      const elementName = node.type === "element" ? String(node.attrs?.name || "") : undefined;
      const handler = elementName
        ? (lookup(handlers?.elements, elementName) ??
          lookup(handlers?.elements, "*") ??
          lookup(handlers?.nodes, "element") ??
          lookup(handlers?.nodes, "*"))
        : (lookup(handlers?.nodes, node.type) ?? lookup(handlers?.nodes, "*"));
      let result: T[];

      if (handler) {
        result = array(await handler(node, context));
      } else if (node.type === "doc") {
        result = await context.children(node);
      } else if (node.type === "title") {
        const title = settings.title ?? "heading";

        if (title === "omit") return [];
        if (typeof title === "object") {
          setMetadata(frontmatter, title.key || "title", textContent(node));
          return [];
        }
        result = array(
          await adapter.encode({ ...node, type: "heading", attrs: { level: 1 } }, context)
        );
      } else if (node.type === "property") {
        if (settings.properties !== undefined && settings.properties !== "omit") {
          const name = String(node.attrs?.label || "Property");
          const value = node.attrs?.value ?? "";
          const normalized =
            node.attrs?.type === "number" ? (value === "" ? null : Number(value)) : value;

          setMetadata(frontmatter, name, normalized);
        }
        return [];
      } else if (node.type === "fragment") {
        const name = String(node.attrs?.name || "Content");
        const mapping =
          lookup(settings.fragments?.named, name) ?? settings.fragments?.default ?? "unwrap";

        if (mapping === "omit") return [];
        if (mapping === "unwrap") return context.children(node);

        result = await context.encode({
          type: "element",
          attrs: { name: mapping.name, props: { name }, selfClosing: false },
          content: node.content
        });
      } else {
        result = array(await adapter.encode(node, context));
      }
      if (!result.length) return result;

      for (const mark of marks.reverse()) {
        const handler = lookup(handlers?.marks, mark.type) ?? lookup(handlers?.marks, "*");

        result = array(
          await (handler ? handler(mark, result, context) : adapter.mark(mark, result, context))
        );
      }
      return result;
    };
    const children = await encode(document, []);

    if (!adapter.frontmatter && Object.keys(frontmatter).length)
      throw new ConversionError(`${adapter.name} does not support frontmatter`);

    return { tree: adapter.root(children), frontmatter };
  };

  return {
    toAST,
    async encode(document: ContentNode, options?: ExportConverterOptions<T>): Promise<string> {
      const result = await toAST(document, options);

      return writeFrontmatter(result.frontmatter, await adapter.stringify(result.tree));
    }
  };
};

/**
 * Build an async import-only converter using the shared content mappings.
 *
 * @param adapter - Parser, decode handler, and node-type lookup. No export stubs are needed.
 * @param defaults - Reusable import mappings and handlers, merged by key with per-call overrides.
 * @returns Only decode() and fromAST(), both async. Parsers, handlers, and image callbacks may
 * be async. Export methods are absent at runtime and in TypeScript. No content is saved.
 * Imports create an entry with a title by default; document: "fragment" retains headings as body
 * content. Unsupported input is handled by the adapter; parser and handler errors pass through.
 */
const createImportConverter = <T>(
  adapter: ImportFormatAdapter<T>,
  defaults: ImportConverterOptions<T> = {}
): ImportConverter<T> => {
  const fromAST = async (
    input: ConvertedAST<T>,
    options: ImportConverterOptions<T> = {}
  ): Promise<ContentNode> => {
    const settings = mergeOptions(defaults, options);
    const decode = async (node: T, path: readonly number[]): Promise<ContentNode[]> => {
      const context: DecodeContext<T> = {
        options: settings,
        path,
        decode: (child) => decode(child, path),
        children: async (children) => {
          const output: ContentNode[] = [];

          for (const [index, child] of children.entries())
            output.push(...(await decode(child, [...path, index])));
          return output;
        },
        image: async (image) => {
          const assetID = await settings.imageAssetID?.(image);

          if (!assetID)
            throw new ConversionError("An imageAssetID callback must resolve the image URL", path);
          return { type: "image", attrs: { assetID, alt: image.alt, caption: image.title || "" } };
        }
      };
      const handlers = settings.decode;
      const type = adapter.type(node);
      const name = adapter.elementName?.(node);
      const mark = adapter.markName?.(node);
      const handler =
        (name
          ? (lookup(handlers?.elements, name) ?? lookup(handlers?.elements, "*"))
          : undefined) ??
        (mark ? (lookup(handlers?.marks, mark) ?? lookup(handlers?.marks, "*")) : undefined) ??
        lookup(handlers?.nodes, type) ??
        lookup(handlers?.nodes, "*");
      const result = array(
        await (handler ? handler(node, context) : adapter.decode(node, context))
      );

      return result.flatMap((content) => {
        if (content.type !== "element") return [content];

        const props = content.attrs?.props as Record<string, unknown> | undefined;
        const fragmentName = typeof props?.name === "string" ? props.name : undefined;
        const mapping = fragmentName
          ? (lookup(settings.fragments?.named, fragmentName) ?? settings.fragments?.default)
          : undefined;

        if (mapping && typeof mapping === "object" && mapping.name === content.attrs?.name) {
          return [
            {
              type: "fragment",
              attrs: { name: fragmentName },
              content: content.content || [{ type: "paragraph" }]
            }
          ];
        }
        return [content];
      });
    };
    const content = await decode(input.tree, []);
    const title = settings.title ?? "heading";
    const titleKey = typeof title === "object" ? title.key || "title" : undefined;
    const properties: ContentNode[] = [];
    let titleText = "";

    if (titleKey && input.frontmatter[titleKey] !== undefined)
      titleText = String(input.frontmatter[titleKey]);
    if (
      title === "heading" &&
      settings.document !== "fragment" &&
      content[0]?.type === "heading" &&
      content[0].attrs?.level === 1
    ) {
      titleText = textContent(content.shift()!);
    }
    if (settings.properties && settings.properties !== "omit") {
      for (const [label, value] of Object.entries(input.frontmatter)) {
        if (label === titleKey) continue;

        const type =
          typeof value === "number"
            ? "number"
            : typeof value === "boolean"
              ? "checkbox"
              : Array.isArray(value) && value.every((item) => typeof item === "string")
                ? "multi-select"
                : "text";

        if (type === "text" && value !== null && typeof value !== "string")
          throw new ConversionError(`Property ${label} cannot represent this frontmatter value`);

        properties.push({ type: "property", attrs: { label, type, value: value ?? "" } });
      }
    }
    const body: ContentNode[] = settings.targetFragment
      ? [
          {
            type: "fragment",
            attrs: { name: settings.targetFragment },
            content: content.length ? content : [{ type: "paragraph" }]
          }
        ]
      : content;

    return {
      type: "doc",
      content: [
        ...(settings.document === "fragment"
          ? []
          : [{ type: "title", content: textNode(titleText) }]),
        ...properties,
        ...(body.length ? body : [{ type: "paragraph" }])
      ]
    };
  };

  return {
    fromAST,
    async decode(source: string, options?: ImportConverterOptions<T>): Promise<ContentNode> {
      const input = adapter.frontmatter ? readFrontmatter(source) : { source, frontmatter: {} };

      return fromAST(
        { tree: await adapter.parse(input.source), frontmatter: input.frontmatter },
        options
      );
    }
  };
};

/**
 * Build an async converter for a custom format that supports both import and export.
 *
 * @param adapter - Full adapter with parser, serializer, and mappings for both directions.
 * @param defaults - Shared defaults and direction-specific handlers. Per-call maps merge by key.
 * @returns encode(), toAST(), decode(), and fromAST(), composed from the one-way factories.
 * Each method accepts options for its own direction. No content is saved or uploaded.
 * Defaults render titles as H1s, unwrap fragments, and omit properties. Removed boundaries and
 * omitted data cannot be recovered on import; choose explicit mappings when preservation matters.
 */
const createConverter = <T>(
  adapter: FormatAdapter<T>,
  defaults: ConverterOptions<T> = {}
): Converter<T> => ({
  ...createExportConverter(adapter, defaults),
  ...createImportConverter(adapter, defaults)
});
const setMetadata = (metadata: Record<string, unknown>, key: string, value: unknown): void => {
  if (Object.hasOwn(metadata, key))
    throw new ConversionError(`Duplicate frontmatter field: ${key}`);

  metadata[key] = value;
};
const mergeOptions = <T>(
  defaults: ConverterOptions<T>,
  options: ConverterOptions<T>
): ConverterOptions<T> => ({
  ...defaults,
  ...options,
  fragments: {
    ...defaults.fragments,
    ...options.fragments,
    named: { ...defaults.fragments?.named, ...options.fragments?.named }
  },
  encode: {
    nodes: { ...defaults.encode?.nodes, ...options.encode?.nodes },
    marks: { ...defaults.encode?.marks, ...options.encode?.marks },
    elements: { ...defaults.encode?.elements, ...options.encode?.elements }
  },
  decode: {
    nodes: { ...defaults.decode?.nodes, ...options.decode?.nodes },
    marks: { ...defaults.decode?.marks, ...options.decode?.marks },
    elements: { ...defaults.decode?.elements, ...options.decode?.elements }
  }
});

export { createConverter, createExportConverter, createImportConverter };
