# @andesine/converters

Converts [Andesine](https://andesine.app) content to and from Markdown, MDX, Markdoc, HTML, and
plain text.

## Install

```sh
npm install @andesine/converters
```

## Example

```ts
import { publishedContentOptions } from "@andesine/converters";
import { toHTML } from "@andesine/converters/html";
import { fromMarkdown } from "@andesine/converters/markdown";

const html = await toHTML(page.content, publishedContentOptions(page));
const document = await fromMarkdown("# Installation\n\nRun `npm install`.");
```

Each format has its own entry point: `@andesine/converters/markdown`, `/mdx`, `/markdoc`, `/html`,
and `/text`.

## Documentation

- [Converters](https://andesine.app/docs/developers/converters/)
- [SDK](https://andesine.app/docs/developers/sdk/)

## License

MIT
