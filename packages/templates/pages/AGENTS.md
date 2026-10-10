# AGENTS.md

Rules for coding agents that write or change pages in this Andesine Pages site.

## File layout

- Pages are `.md` or `.mdx` files in the directory of a files source, e.g.
  `src/content/docs/`. `andesine.config.ts` lists the sources and their mounts.
- The file path gives the URL: `guides/setup.md` is `/guides/setup/`, and
  `guides/index.md` is the landing page of the `guides` group.
- A folder is a navigation group. Add an `index.md(x)` to give it a landing page and
  a title.
- Put images next to the page and link them with a relative path.
- Do not edit `dist/`, `.astro/`, or `node_modules/`. Do not put the API key in any
  file; `.env` holds it and is not committed.

## Frontmatter

Every page needs a `title`. The other fields are optional:

| Field              | Default | Use                                                 |
| ------------------ | ------- | --------------------------------------------------- |
| `description`      | None    | One sentence for search, previews, and social cards |
| `order`            | `0`     | Position in the group; lower numbers come first     |
| `slug`             | None    | A URL path that replaces the file path              |
| `navigationLabel`  | `title` | A shorter label for the navigation                  |
| `navigationHidden` | `false` | Leave the page out of the navigation                |
| `searchHidden`     | `false` | Leave the page out of search and agent files        |
| `toc`              | `true`  | Show the table of contents                          |
| `layout`           | `docs`  | `wide` for a page without a table of contents       |
| `updatedAt`        | None    | Date of the last change, e.g. `2026-10-04`          |

Unknown fields and invalid values stop the build. Two pages with the same URL stop
the build too.

## Content

- Start the body with the first paragraph; the layout shows the title. Use `##` and
  `###` headings; they make the table of contents.
- Link to other pages with relative links, e.g. `../configuration/`.
- Give code blocks a language, and a `title` when they show a file:
  ` ```ts title="andesine.config.ts" `.

## Components

MDX pages use these components without imports. `src/components/content/index.ts`
lists them; add a component there before you use it.

| Component          | Use                                                        |
| ------------------ | ---------------------------------------------------------- |
| `Callout`          | `type`: `note` (default), `tip`, `warning`, or `danger`    |
| `Tabs`, `Tab`      | Alternatives; tabs with the same `syncKey` share selection |
| `CodeGroup`        | Code blocks in tabs, from their `title`s                   |
| `Steps`            | An ordered list of steps                                   |
| `FileTree`         | A nested list of files and folders                         |
| `CardGrid`, `Card` | Links with `title`, `icon` (an Iconify class), and `href`  |
| `Disclosure`       | Content that opens on click, with a `title`                |
| `Figure`           | An image (as content) with a `caption`                     |
| `Operation`        | An API operation: `source` and `id` of an OpenAPI source   |
| `Visibility`       | Content for one audience; see below                        |

Leave an empty line around Markdown content inside `Steps`, `CodeGroup`, and
`FileTree`.

## Visibility

The site has two versions of each page: the web page, and a Markdown version that AI
agents read (the page URL with `index.md`, and `llms-full.txt`).

- `<Visibility for="humans">` content is only on the web page. Use it for UI
  directions, e.g. "Select **Copy page**".
- `<Visibility for="agents">` content is only in the Markdown version. Use it for
  directions that an agent can follow, e.g. a file to edit or a URL to fetch.
- Use one block for each audience, side by side. Do not nest `Visibility` blocks.

## Checks

Run `npm run check` and `npm run build` after changes. The build checks the
frontmatter, the URLs, and the API operations that pages embed.
