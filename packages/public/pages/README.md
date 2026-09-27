# @andesine/pages

The Astro integration and data layer of Andesine Pages. Use it with the Andesine
Pages template, which supplies the layouts, styles, and components.

## Exports

| Export                        | Contents                                 |
| ----------------------------- | ---------------------------------------- |
| `@andesine/pages`             | `defineConfig()`, config and page types. |
| `@andesine/pages/integration` | The `andesine()` Astro integration.      |
| `@andesine/pages/collections` | Content collections for the sources.     |
| `@andesine/pages/astro`       | Helpers for the template's components.   |
| `@andesine/pages/client`      | The browser search client.               |

## Setup

`andesine.config.ts`:

```ts
import { defineConfig } from "@andesine/pages";

export default defineConfig({
  name: "Example",
  site: "https://docs.example.com"
});
```

`astro.config.ts`:

```ts
import { defineConfig } from "astro/config";
import { andesine } from "@andesine/pages/integration";

export default defineConfig({ integrations: [andesine()] });
```

`src/content.config.ts`:

```ts
export { collections } from "@andesine/pages/collections";
```

The integration reads `andesine.config.ts` and sets the Astro `site`, `base`, and
`trailingSlash` options. It adds one static route for the pages of all files
sources. Each page renders with `src/layouts/page.astro`. The layout receives one
`page` prop with the type `PageContext`, and the page body in its default slot.

A source mount or the site root without a page redirects to the first page. The
build stops when two pages use the same URL.

| Option       | Default                           | Description                              |
| ------------ | --------------------------------- | ---------------------------------------- |
| `config`     | `andesine.config.ts`              | Config file, relative to the root.       |
| `layout`     | `src/layouts/page.astro`          | Page layout, relative to the root.       |
| `components` | `src/components/content/index.ts` | MDX component map, relative to the root. |

Andesine sources read the latest publication with `@andesine/sdk`. Build-time
(`ssg`) sources load in a content collection and copy their images into the build;
request-time (`ssr`) sources load for each request and need a server adapter.
Content converts with `@andesine/converters`, so heading IDs match Andesine search
and answers, and renders with the same component map as MDX.

## Search

Local pages are in a Pagefind index. The build writes it to `pagefind/`, and the dev
server builds it in memory from the source text. Andesine sources use the published
search API through `/_andesine/search/`, a server route that keeps the API key on
the server. Sites with Andesine sources therefore need a server adapter. Results
of build-time sources link only to pages in the build; results of pages that were
published after the build are left out. Pages with `searchHidden` are left out of
results. This is not access control.

`createSearchClient(page.site.search)` from `@andesine/pages/client` searches all
sources and returns results grouped by source.

The component map module exports `components`. MDX pages can use these components
without imports. The integration adds a plugin to the Sätteri Markdown processor
that prepares `<Tabs>`, `<CodeGroup>`, and `<FileTree>` content, and a Shiki
transformer that reads `title="..."` from code fences.

Relative `logo.src` and `favicon` paths in the config are relative to the config
file. The integration bundles them as assets.
