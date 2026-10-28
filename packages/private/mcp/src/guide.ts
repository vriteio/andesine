const MDX_GUIDE = `# Andesine MDX

Entries are read and written as MDX: Markdown with JSX elements. Only the syntax below is kept; other MDX (imports, exports, expressions) is refused.

## Title

The first line is the title as a level 1 heading: \`# Entry title\`. Use level 2 and lower headings in the content.

## Markdown

- Paragraphs, headings (\`##\` to \`######\`), **bold**, *italic*, ~~strikethrough~~, \`inline code\`, and links.
- Bullet lists, numbered lists, and task lists (\`- [ ]\`, \`- [x]\`).
- Block quotes, horizontal rules (\`---\`), fenced code blocks with a language and an optional title (\`\` \`\`\`bash title="Install" \`\`), and GFM tables.
- A line break inside a paragraph: end the line with a backslash.

## Images

- \`![Alt text](asset:ast_...)\` shows a workspace image. Keep these references when you edit around an image.
- \`![Alt text]()\` is an image placeholder, which people fill in the editor.
- \`![Alt text](https://example.com/image.png)\`: the image is imported into the workspace when the entry is saved.

## Links to entries

- \`[Text](entry:/Collection/Entry)\` links to another entry by path. Paths become entry IDs when saved, so links survive renames and moves.
- Reads return \`[Text](entry:ent_...)\`; the \`references\` of a read list the linked entries with their paths.

## Schema fields

Collections can have a schema with fields. Read it with get_schema or the \`andesine://collections/{path}/schema\` resource.

- Properties: \`<Property name="Field name" value={...} />\`, where the value is static JSON of the field type, for example \`value="Draft"\`, \`value={3}\`, \`value={true}\`, or \`value={["a", "b"]}\`.
- Fragments: \`<Fragment name="Field name">\` with MDX content, closed with \`</Fragment>\`.
- Keep the field names of the schema. Required fields must have a value.

## Custom elements

Other JSX elements are kept as block elements. Put the opening and closing tags on their own lines, with MDX content between them:

\`\`\`mdx
<Callout type="info">
Text with **Markdown**.
</Callout>
\`\`\`

Self-closing elements, such as \`<Video src="https://example.com/a.mp4" />\`, also go on their own line. Attributes must be static JSON values (strings, numbers, booleans, arrays, or objects). Elements inside a paragraph aren't supported. Property and Fragment are reserved names.

The workspace's extensions draw some elements in the editor, e.g. \`<Tabs>\` with \`<Tab>\` elements. Read \`andesine://guide/elements\` for them: their props and which blocks their content accepts.

## Escaping

- In text, escape \`<\` and \`{\` with a backslash: \`\\<\` and \`\\{\`.
- Comments (\`{/* */}\` and \`<!-- -->\`) aren't supported, because entries can't keep them.
`;

export { MDX_GUIDE };
