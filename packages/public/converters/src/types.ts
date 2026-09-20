interface ContentMark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface ContentNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ContentNode[];
  marks?: ContentMark[];
  text?: string;
}
interface ImageReference {
  url: string;
  alt: string;
  title?: string;
}
interface EncodeContext<T> {
  /** Generated heading anchor for this node, when available. Stable within the full document. */
  anchor?: string;
  /** Merged factory defaults and per-call options. */
  options: ExportConverterOptions<T>;
  /** Child indexes identifying the current node in the source document. */
  path: readonly number[];
  /** Encode another node at the current path, applying custom handlers and marks. */
  encode(node: ContentNode): Promise<T[]>;
  /** Encode child nodes in order, updating their paths and awaiting async handlers. */
  children(node: ContentNode): Promise<T[]>;
  /** Resolve an image through imageURL; throws ConversionError if no URL is supplied. */
  imageURL(node: ContentNode): Promise<string>;
}
interface DecodeContext<T> {
  /** Merged factory defaults and per-call options. */
  options: ImportConverterOptions<T>;
  /** Child indexes identifying the current node in the parsed tree. */
  path: readonly number[];
  /** Decode another format node at the current path, applying custom handlers. */
  decode(node: T): Promise<ContentNode[]>;
  /** Decode child nodes in order, updating their paths and awaiting async handlers. */
  children(nodes: readonly T[]): Promise<ContentNode[]>;
  /** Resolve a URL through imageAssetID and create an image node; does not upload assets. */
  image(reference: ImageReference): Promise<ContentNode>;
}
interface EncodeHandlers<T> {
  /** Handlers keyed by ProseMirror node type. "*" handles otherwise unmatched node types. */
  nodes?: Record<
    string,
    (node: ContentNode, context: EncodeContext<T>) => Awaitable<HandlerResult<T>>
  >;
  /** Handlers keyed by Andesine element name; exact and "*" matches precede node handlers. */
  elements?: Record<
    string,
    (node: ContentNode, context: EncodeContext<T>) => Awaitable<HandlerResult<T>>
  >;
  /** Handlers keyed by mark type, with "*" as fallback. Receives already encoded children. */
  marks?: Record<
    string,
    (mark: ContentMark, children: T[], context: EncodeContext<T>) => Awaitable<HandlerResult<T>>
  >;
}
interface DecodeHandlers<T> {
  /** Handlers keyed by adapter node type, with "*" as fallback. */
  nodes?: Record<
    string,
    (node: T, context: DecodeContext<T>) => Awaitable<HandlerResult<ContentNode>>
  >;
  /** Element-name handlers, including "*", checked before mark-name and node-type handlers. */
  elements?: Record<
    string,
    (node: T, context: DecodeContext<T>) => Awaitable<HandlerResult<ContentNode>>
  >;
  /** Mark-name handlers, including "*", checked after element handlers and before node handlers. */
  marks?: Record<
    string,
    (node: T, context: DecodeContext<T>) => Awaitable<HandlerResult<ContentNode>>
  >;
}
interface BaseConverterOptions {
  /** Map the title to an H1 by default, omit it, or use frontmatter in supported formats. */
  title?: "heading" | "omit" | { as: "frontmatter"; key?: string };
  /** Omit properties by default, or map labels and values to frontmatter. Duplicate keys throw. */
  properties?: "omit" | { as: "frontmatter" };
  /** Fragment mappings. Defaults to unwrapping content; unwrapped boundaries cannot be restored. */
  fragments?: {
    /** Fallback for fragments without a named mapping. Defaults to "unwrap". */
    default?: FragmentMapping;
    /** Overrides keyed by fragment name, merged by key with factory defaults. */
    named?: Record<string, FragmentMapping>;
  };
}
/** Options used only when exporting ProseMirror JSON to another format. */
interface ExportConverterOptions<T> extends BaseConverterOptions {
  /** Resolve an image asset to a URL during export. Required for image output except plain text. */
  imageURL?: (node: ContentNode) => Awaitable<string>;
  /** Export handlers. Return one node, multiple nodes, or null to omit; async handlers are awaited. */
  encode?: EncodeHandlers<T>;
}
/** Options used only when importing another format as ProseMirror JSON. */
interface ImportConverterOptions<T> extends BaseConverterOptions {
  /** Import an entry with a title by default, or a fragment without consuming an H1 as title. */
  document?: "entry" | "fragment";
  /** On import, wrap body content in this named fragment. Defaults to leaving it unwrapped. */
  targetFragment?: string;
  /** Resolve an imported image URL to an existing asset ID. Uploading/saving is the caller's job. */
  imageAssetID?: (image: ImageReference) => Awaitable<string>;
  /** Import handlers. Handler maps merge by key with factory defaults; async handlers are awaited. */
  decode?: DecodeHandlers<T>;
}
/** Defaults for a converter that supports both directions. */
interface ConverterOptions<T> extends ExportConverterOptions<T>, ImportConverterOptions<T> {}
interface ConvertedAST<T> {
  /** Target format tree, without serialized frontmatter. */
  tree: T;
  /** Metadata extracted or supplied through title and property mappings. */
  frontmatter: Record<string, unknown>;
}
/** Export-only methods. Import methods are absent both in TypeScript and at runtime. */
interface ExportConverter<T> {
  /**
   * Export ProseMirror JSON as a format string.
   * @param document - An entry or fragment document.
   * @param options - Per-call overrides; handler maps and named fragments merge with defaults.
   * @returns Serialized content, including mapped frontmatter when supported.
   * @throws ConversionError for unsupported content, unresolved images, or invalid mappings.
   * Custom handler and serializer failures pass through unchanged.
   */
  encode(document: ContentNode, options?: ExportConverterOptions<T>): Promise<string>;
  /**
   * Export a document as the target format's AST and separate frontmatter.
   * @param document - Source ProseMirror document.
   * @param options - Per-call mappings and handlers merged over factory defaults.
   * @returns The converted tree and metadata without string serialization.
   * @throws The same conversion errors as encode(), including unsupported frontmatter mappings.
   */
  toAST(document: ContentNode, options?: ExportConverterOptions<T>): Promise<ConvertedAST<T>>;
}
/** Import-only methods. Export methods are absent both in TypeScript and at runtime. */
interface ImportConverter<T> {
  /**
   * Import a format string as ProseMirror JSON.
   * @param source - Text in the adapter's format, with optional supported frontmatter.
   * @param options - Per-call overrides; imageAssetID resolves imported images without uploading.
   * @returns An entry document by default; document: "fragment" omits the title node.
   * @throws ConversionError for unsupported content or mappings; parser/handler errors pass through.
   */
  decode(source: string, options?: ImportConverterOptions<T>): Promise<ContentNode>;
  /**
   * Import an already parsed AST and its metadata.
   * @param input - Format tree and frontmatter object; use an empty object when metadata is absent.
   * @param options - Per-call mappings and handlers merged over factory defaults.
   * @returns ProseMirror JSON without parsing a string or saving content.
   * @throws The same conversion errors as decode(), excluding string-parser errors.
   */
  fromAST(input: ConvertedAST<T>, options?: ImportConverterOptions<T>): Promise<ContentNode>;
}
/** Shared conversion methods returned by the full format factories. No method saves or uploads content. */
interface Converter<T> extends ExportConverter<T>, ImportConverter<T> {}
interface BaseFormatAdapter {
  /** Human-readable format name used in errors. */
  name: string;
  /** Whether the format supports frontmatter mappings. Defaults to false. */
  frontmatter?: boolean;
}
/** Export adapter: no parser, decode handler, or format-node lookup is required. */
interface ExportFormatAdapter<T> extends BaseFormatAdapter {
  /** Wrap converted child nodes in the format's root node. */
  root(children: T[]): T;
  /** Serialize the format tree; the shared converter writes frontmatter separately. */
  stringify(tree: T): Awaitable<string>;
  /** Encode a node without a custom handler. Shared title/property/fragment mappings run first. */
  encode(node: ContentNode, context: EncodeContext<T>): Awaitable<HandlerResult<T>>;
  /** Apply a mark to encoded children when no custom mark handler matches. */
  mark(mark: ContentMark, children: T[], context: EncodeContext<T>): Awaitable<HandlerResult<T>>;
}
/** Import adapter: no root builder, serializer, encode handler, or mark writer is required. */
interface ImportFormatAdapter<T> extends BaseFormatAdapter {
  /** Return the format node type used to select decode node handlers. */
  type(node: T): string;
  /** Return a custom element name for decode element-handler lookup, if present. */
  elementName?(node: T): string | undefined;
  /** Return a mark name for decode mark-handler lookup, if present. */
  markName?(node: T): string | undefined;
  /** Parse source text after the shared converter removes supported frontmatter. */
  parse(source: string): Awaitable<T>;
  /** Decode a format node when no custom decode handler matches. */
  decode(node: T, context: DecodeContext<T>): Awaitable<HandlerResult<ContentNode>>;
}
/** Adapter contract for a format supporting both import and export. */
interface FormatAdapter<T> extends ExportFormatAdapter<T>, ImportFormatAdapter<T> {}

type Awaitable<T> = T | Promise<T>;
type HandlerResult<T> = T | T[] | null;
type FragmentMapping = "unwrap" | "omit" | { as: "element"; name: string };

export type {
  Awaitable,
  ContentMark,
  ContentNode,
  ConvertedAST,
  Converter,
  ConverterOptions,
  DecodeContext,
  DecodeHandlers,
  EncodeContext,
  EncodeHandlers,
  ExportConverter,
  ExportConverterOptions,
  ExportFormatAdapter,
  ImportConverter,
  ImportConverterOptions,
  ImportFormatAdapter,
  FormatAdapter,
  FragmentMapping,
  HandlerResult,
  ImageReference
};
