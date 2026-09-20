# @andesine/converters

MIT-licensed, async converters for Andesine ProseMirror JSON. ESM only. Use in
Node.js 22+, browsers, and workers. No editor instance, DOM, API client, or network
connection is required. The library does not save content or upload assets.

```sh
npm install @andesine/converters
```

See the [release guide](https://github.com/vriteio/andesine/blob/andesine/packages/public/README.md)
for builds, archive checks, versioning, and npm publishing. This package uses the
[MIT license](./LICENSE).

## Formats

| Import                          | Output       | Input          |
| ------------------------------- | ------------ | -------------- |
| `@andesine/converters/markdown` | `toMarkdown` | `fromMarkdown` |
| `@andesine/converters/mdx`      | `toMDX`      | `fromMDX`      |
| `@andesine/converters/markdoc`  | `toMarkdoc`  | `fromMarkdoc`  |
| `@andesine/converters/html`     | `toHTML`     | `fromHTML`     |
| `@andesine/converters/text`     | `toText`     | —              |

All conversion functions return promises. Callbacks and handlers may return a
value or a promise. Formats have separate entry points; there is no root export
that loads every parser. Installation includes all format dependencies.

Markdoc's declarations reference its React renderer types, so this package also
includes `@types/react` for strict TypeScript consumers. No React runtime is
required or loaded by the converters.

```ts
import { toMarkdown, fromMarkdown } from "@andesine/converters/markdown";

const source = await toMarkdown(document);
const importedDocument = await fromMarkdown("# Title\n\nHello **world**.");
```

Input converters return a `doc` with a title and body content. If no title is
mapped, the title is empty. Use `{ document: "fragment" }` to return body content
without a title. The same setting prevents the first heading from becoming a
title. Use `targetFragment: "body"` to put imported body content in a named
fragment.

## Reusable mapping options

```ts
import { createMDXConverter } from "@andesine/converters/mdx";

const converter = createMDXConverter({
  title: { as: "frontmatter", key: "title" },
  properties: { as: "frontmatter" },
  fragments: {
    default: "unwrap",
    named: {
      summary: { as: "element", name: "Fragment" },
      internalNotes: "omit"
    }
  }
});

const source = await converter.encode(document);
const restored = await converter.decode(source);
```

Factory names are `createMarkdownConverter`, `createMDXConverter`,
`createMarkdocConverter`, `createHTMLConverter`, and `createTextConverter`.
Per-call options override saved options; handler maps and named fragment mappings
merge by key.

| Field      | Default             | Other mappings                                  |
| ---------- | ------------------- | ----------------------------------------------- |
| Title      | First-level heading | `"omit"`, `{ as: "frontmatter", key: "title" }` |
| Properties | Omit                | `{ as: "frontmatter" }`                         |
| Fragments  | `"unwrap"`          | `"omit"`, `{ as: "element", name: "Fragment" }` |

Unwrap removes the fragment boundary and retains its content in document order.
Omit removes the content too. The number of fragments does not change the default.
MDX wrappers become components; Markdoc wrappers become tags; HTML wrappers use
`data-andesine-element` and JSON `data-andesine-props` on a `div`. Markdown needs
a custom handler for fragment wrappers. HTML and plain text reject frontmatter
output; use their AST result or your own surrounding document for metadata.

On import, matching named wrappers become fragments. Unwrapped boundaries cannot
be recovered. With heading mapping, only the first root heading, at level one,
becomes the title. With frontmatter mapping, the selected field becomes the title.

Property labels become frontmatter keys. Duplicate keys, including a collision
with the title field, cause an error. Import infers text, number, checkbox, and
multi-select properties from scalar values and string arrays. Date, URL, and
select fields import as text; select options and schema metadata are not retained.
Object-valued properties need custom handling. Unmapped frontmatter is ignored.

## Heading anchors

`getHeadingAnchors(document)` returns `{ path, text, anchor }` for each heading in
document order. It is exported from the package root and the dependency-free
`@andesine/converters/anchors` entry point. `path` is the array of child indexes
from the document root. The same helper supplies search and answer-source anchors.

Anchors use NFC-normalized lowercase heading text. Punctuation is removed,
whitespace and underscores become hyphens, and empty results use `section`.
Letters, numbers, and combining marks are retained. Collisions receive `-1`,
`-2`, and later suffixes until the ID is unique, including collisions with names
that already contain a suffix. All fragments share one counter. Titles and
properties do not create anchors or consume IDs.

HTML headings receive the ID automatically. Markdown and MDX AST headings carry
it in `data.hProperties.id`; Markdoc AST headings carry it in `attributes.id`.
String serialization for Markdown, MDX, and Markdoc does not preserve this AST
metadata. Configure the final renderer to apply these IDs, or use a custom
heading handler. Do not assume a renderer's own slug rules match Andesine.

Custom encode handlers receive `context.anchor` for original heading nodes:

```ts
const html = await toHTML(document, {
  encode: {
    nodes: {
      heading: async (node, context) => ({
        type: "element",
        tagName: `h${node.attrs?.level || 1}`,
        properties: { id: context.anchor },
        children: await context.children(node)
      })
    }
  }
});
```

The converter calculates anchors before applying fragment mappings. Omitting a
fragment does not renumber later headings, but links to omitted headings have no
target. A renderer that reorders, replaces, or omits content is responsible for
adapting links. Anchors are stable within a content version, not across edits.
Plain text does not have link targets. Import does not retain supplied heading IDs;
anchors are derived again from the imported document.

## Images

Published content already includes image URLs. Use them directly:

```ts
import { publishedContentOptions } from "@andesine/converters";
import { toMarkdown } from "@andesine/converters/markdown";

const page = await client.content.get({ path: "/Docs/Getting started" });
const source = await toMarkdown(page.content, {
  ...publishedContentOptions(page),
  title: { as: "frontmatter" }
});
```

`publishedContentOptions(page, options?)` returns only an `imageURL` callback.
It works with single published-content responses and full items from
`content.listEntries`. It does not change title, property, or fragment mappings.
The converter package has no SDK dependency; any object with a compatible
`assets` array works.

`createImageURLResolver(assets, options?)` returns that async callback directly.
Each asset needs `assetID`, `variant`, and `url`. The default variant is `display`.
Set `{ variant: "thumbnail" }`, or select a variant per image:

```ts
const options = publishedContentOptions(page, {
  variant: async (image) => (image.attrs?.small ? "thumbnail" : "display")
});
```

The resolver returns the supplied URL unchanged. It does not fetch images, build
URLs, or fall back to another variant. Missing assets or variants throw
`ConversionError`. Keep assets from the same entry and snapshot as the content.
An explicit `imageURL` callback can override this helper through the normal
converter options. Import still needs your own `imageAssetID` callback.

Images need reference resolution in both directions:

```ts
const source = await toMarkdown(document, {
  imageURL: async (image) => {
    const assetID = String(image.attrs?.assetID);
    return assets.get(assetID)!.url;
  }
});

const importedDocument = await fromMarkdown(source, {
  imageAssetID: async ({ url, alt, title }) => resolveAsset(url, alt, title)
});
```

Callbacks return a URL or asset ID. A missing resolution causes an error. The
caller may perform network work in callbacks; the library performs none itself.
Plain text uses alt text, or the caption when alt text is absent, without resolving
an image URL. Published snapshot URLs may expire; decide where exported assets
will live before resolving them.

## Custom and wildcard handlers

Handlers can return a node, an array of nodes, or `null` to omit content. Exact
element handlers take precedence over wildcard element handlers. Node and mark
handlers also support `"*"`. Custom handlers take precedence over built-ins.

```ts
import { createMDXConverter, mdxAdapter } from "@andesine/converters/mdx";

const converter = createMDXConverter({
  encode: {
    elements: {
      "Callout": async (node, context) =>
        mdxAdapter.encode(
          {
            ...node,
            attrs: { ...node.attrs, name: "Notice" }
          },
          context
        ),
      "*": async (node, context) =>
        mdxAdapter.encode(
          {
            ...node,
            attrs: { ...node.attrs, name: `Components.${node.attrs?.name}` }
          },
          context
        )
    }
  }
});
```

The built-in MDX element handler already maps arbitrary Andesine element names
and static properties to MDX elements. Wildcards let you change that mapping for
all elements. Decode handlers are independent: define a matching handler when
custom output should convert back to the original element.

```ts
import { element } from "@andesine/converters";

const converter = createMDXConverter({
  decode: {
    elements: {
      Notice: async (node, context) => {
        if (node.type !== "mdxJsxFlowElement") {
          throw new Error("Notice must be a block element");
        }
        return element("Callout", {}, await context.children(node.children));
      }
    }
  }
});
```

Encoder contexts expose `encode`, `children`, `imageURL`, options, and the content
path. Decoder contexts expose `decode`, `children`, `image`, options, and the AST
path. Calling the adapter's built-in handler bypasses custom dispatch; calling
`context.encode` or `context.decode` uses custom dispatch again. Avoid passing the
same unchanged node back through dispatch from its own handler.

`encode.nodes` is keyed by Andesine node type; `encode.marks` by mark type.
`decode.nodes` is keyed by native AST type (HTML uses tag names for elements).
`decode.marks` uses Andesine mark names. `decode.elements` uses component/tag names.
A node wildcard also matches the document root; delegate roots if your wildcard
is intended to omit only unknown leaves.

## Syntax trees and custom formats

Each bidirectional format exports `to…AST` and `from…AST`. They use
`{ tree, frontmatter }`, so metadata is separate from the format tree. The trees are
mdast for Markdown/MDX, Markdoc nodes for Markdoc, and hast for HTML. Plain text
exports `toTextAST` with a small text tree.

```ts
const result = await converter.toAST(document);
// Inspect or change result.tree and result.frontmatter.
const restored = await converter.fromAST(result);
```

To add a format, implement `FormatAdapter<T>` and call `createConverter(adapter)`.
The adapter supplies root creation, parsing, stringification, node/mark encoding,
decoding, and optional element/mark name lookup. The core supplies async traversal,
custom handler dispatch, title/property/fragment mapping, and image callbacks.
It does not require a Markdown tree.

For example, this small custom format stores document text as a JSON array. It is
intentionally lossy and supports only paragraphs and text:

```ts
import { createConverter, ConversionError, type FormatAdapter } from "@andesine/converters";

interface ArrayNode {
  type: "root" | "paragraph" | "text";
  value?: string;
  children?: ArrayNode[];
}

const adapter: FormatAdapter<ArrayNode> = {
  name: "Paragraph array",
  type: (node) => node.type,
  root: (children) => ({ type: "root", children }),
  parse: (source) => ({
    type: "root",
    children: (JSON.parse(source) as string[]).map((value) => ({
      type: "paragraph",
      children: [{ type: "text", value }]
    }))
  }),
  stringify: (root) =>
    JSON.stringify(
      root.children?.map((node) => node.children?.map((child) => child.value || "").join(""))
    ),
  async encode(node, context) {
    if (node.type === "text") return { type: "text", value: node.text };
    if (node.type === "paragraph")
      return { type: "paragraph", children: await context.children(node) };
    throw new ConversionError(`Unsupported node: ${node.type}`);
  },
  mark: (_mark, children) => children,
  async decode(node, context) {
    if (node.type === "text") return { type: "text", text: node.value || "" };
    const content = await context.children(node.children || []);
    return node.type === "root" ? content : { type: "paragraph", content };
  }
};

const converter = createConverter(adapter, { title: "omit", document: "fragment" });
```

## Preservation and limits

These are content conversions, not document backups. They preserve the supported
content subset, not exact source text. Node IDs, schema links, inherited-field
metadata, editor layout, original whitespace, and source syntax choices are not
preserved. There is no detailed loss report. Unsupported nodes, marks, or syntax
throw; explicit mappings and the losses below do not.

| Feature                             | Markdown / MDX                            | Markdoc                          | HTML                              | Plain text          |
| ----------------------------------- | ----------------------------------------- | -------------------------------- | --------------------------------- | ------------------- |
| Paragraphs, headings, quotes, lists | Yes                                       | Yes                              | Yes                               | Text and separators |
| Bold, italic, strike, code, links   | Yes                                       | Yes                              | Yes                               | Formatting removed  |
| Subscript, superscript, highlight   | Custom handlers                           | Custom handlers                  | Yes; highlight color omitted      | Formatting removed  |
| Task lists                          | GFM                                       | Custom handlers                  | Andesine data attributes          | Checkbox markers    |
| Code blocks                         | Language retained                         | Language retained                | Language retained                 | Code text           |
| Images                              | URL, alt, caption as title                | URL, alt, caption as title       | Image and optional figure caption | Alt/caption text    |
| Tables                              | GFM; single-paragraph cells, no spans     | Single-paragraph cells, no spans | Cell spans and block content      | Tab-separated cells |
| Custom elements                     | MD: custom handler; MDX: static block JSX | Static tags                      | Andesine data attributes          | Custom handler      |

Markdown-like tables normalize the first row to headers. Alignment, column widths,
link targets/titles, image size, and aspect ratio are not preserved. Empty
paragraphs can collapse in Markdown-like output. Mark ordering and adjacent text
node boundaries can change without changing displayed content.

MDX supports block components with static JSON-compatible properties. Expressions
inside property values may contain literal arrays/objects, but no calls, variable
references, spreads, imports, exports, or executable code. Inline JSX and JSX
fragments require custom handlers. Markdoc variables/functions also require custom
handlers. No source is evaluated during conversion.

Mixed bullet/task lists import as task lists with unchecked plain items. Ordered
task lists, Markdown footnotes, and raw HTML require custom handlers. HTML import supports
semantic elements, not arbitrary CSS/layout. Whitespace follows basic HTML
normalization. Scripts, styles, comments, and unknown elements require explicit
handlers. Built-in HTML output escapes text and rejects unsafe URL schemes; custom
handlers are responsible for the output they create. This is not an HTML sanitizer.

Import is not full editor-schema validation. A custom handler must return content
that is valid for its destination, including block/inline placement and allowed
fragment children. If you need a document backup, retain the original JSON.
