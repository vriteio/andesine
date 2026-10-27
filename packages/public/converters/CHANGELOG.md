# Changelog

## 0.8.1

- MDX elements that stand alone, with nothing but other elements and whitespace on their lines,
  import as blocks, e.g. one-line `<Step title="...">...</Step>`s in `<Steps>`. Their content
  becomes a paragraph. Elements between text still need a custom handler.

## 0.8.0

- Code blocks keep an optional `title`: a fence's `title="..."` meta in Markdown and MDX, a
  `{% title="..." %}` annotation in Markdoc, and `data-title` on the `<pre>` in HTML. A titled
  Markdown block without a language is written as `text`. `readCodeTitle` and `formatCodeMeta`
  read and write the meta.

## 0.7.0

- Add the `properties: { as: "element", name }` mapping: each property becomes a self-closing
  element in its position, with `name`, `value`, and `type` when the value doesn't show it.
  Imports with a property mapping read both frontmatter and matching elements.

## 0.6.0

- No changes; versioned with the other public Andesine packages.

## 0.4.0

- Align the version with the other Andesine packages. No functional changes.

## 0.1.0

- Async Markdown, MDX, Markdoc, and HTML conversion, plus plain-text output.
- Configurable title, property, and fragment mappings.
- Async exact and wildcard handlers, native AST access, and a custom format adapter interface.
- Published-content image URL helpers with explicit variant selection and async callbacks, without network access or an SDK dependency.
- Shared heading anchors, HTML heading IDs, AST metadata, and `context.anchor` for custom renderers.
