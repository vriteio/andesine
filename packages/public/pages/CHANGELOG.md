# Changelog

## Unreleased

- Add `defineConfig()` with config validation.
- Add the `andesine()` Astro integration. It reads `andesine.config.ts`, sets the
  Astro site options, and renders pages with the template layout.
- Add the files source: Markdown and MDX pages from a directory, with folder
  groups, index landing pages, frontmatter validation, and slugs.
- Add sections, source mounts, URL collision checks, and redirects to the first
  page.
- Add `PageContext` with navigation, breadcrumbs, headings, and previous and next
  links.
- Add MDX content components: a Sätteri plugin prepares `Tabs`, `CodeGroup`, and
  `FileTree`, and a Shiki transformer adds code block titles. Pages render with the
  template's component map.
- Add Andesine sources: build-time loading with copied images, request-time loading
  for each request, entry property mapping, collection navigation, and content
  rendering with the MDX component map and Andesine heading anchors.
- Add search: a Pagefind index of local pages (build and development), a server
  endpoint for Andesine published search, and a browser client with results
  grouped by source.
- Add AI answers: a streaming server endpoint for Andesine sources, with cited
  pages mapped to page URLs and follow-up history, the `answers` source option,
  a browser answer client, and `renderAnswer` for safe answer Markdown.
- Add outputs: Markdown alternatives at `index.md`, `sitemap.xml`, `llms.txt`,
  `robots.txt`, and a not-found page.
- Add canonical URLs, Markdown URLs, and page actions to `PageContext`, and the
  `pageActions` option.
- Add the `summary` and `aside` slots for Andesine entry fragments.
- Remove the `slug`, `navigationLabel`, and `navigationHidden` Andesine properties.
  URLs and labels come from the publication tree, and an `index` entry is its
  collection's landing page. Request-time pages read only the tree and the current
  entry.
- Support Cloudflare Workers for build-time Andesine sources: no social renderer
  externals with the Cloudflare adapter, and `@iconify/json` loads on first use.
- Read the API key with `getSecret()` from `astro:env/server`, so each adapter
  supplies it from its platform. Hashing uses Web Crypto, fonts decode with
  `atob`, and the build-time image cache is a separate module, so server routes
  do not import Node.js modules.
- Replace the git commit dates of file pages with an optional `updatedAt`
  frontmatter field. Pages without it have no date.
- Add agent outputs: `llms-full.txt`, `/.well-known/llms.txt`, `.md` page aliases,
  an index note in each Markdown page, the `agents.instructions` option,
  absolute links in file page Markdown, an "Optional" section in `llms.txt`, and
  `lastmod` in the sitemap.
- Serve Markdown for requests with `Accept: text/markdown`, and Markdown 404
  responses with related pages for request-time sources.
- Add `<Visibility for="agents">` and `<Visibility for="humans">` for MDX files
  and Andesine content.
- Add schema.org JSON-LD, the last update date, and `noindex` for pages hidden
  from search to `PageContext`.
- Add social images: a generated image for each page from the template's social
  card, the `social` option, and `page.image`. `satori` and `@resvg/resvg-js`
  are optional peer dependencies.
- The integration no longer sets `trailingSlash: "always"`, so pages answer with
  and without the trailing slash. Package URLs still end with a slash.
- The answers endpoint allows 10 questions a minute for each client address.
- The integration inlines a script into each page's `<head>` that restores saved
  navigation tree groups before the first paint.
- Add the `socialLinks` option for footer icon links. `links` are icon links at the
  top of the navigation, and need an `icon`.
- Add `PageContext.meta`, `PageContext.fragments`, and `site.storageKey`;
  `renderTabs` and `readFileTreeItems` in `@andesine/pages/astro` (replacing
  `renderPanels`); and `groupAnswerSources`. The answer client takes earlier
  turns and enforces the API history limits. Social card fonts accept data URLs, and
  `SocialCardData.showSiteName` follows `logo.title`.
- Add the `html` template tag for social card markup: it escapes values and
  leaves out `false`, `null`, and `undefined`. Card markup can use `tw` classes.
- Add `format` (`icon` or `full`) and `alt` to the `logo` option, also in social
  cards.
- Add the `sectionsDisplay` option: sections as header tabs, or as links at the
  top of the navigation.
- The development search index uses the plain text of MDX pages, without JSX tags and
  Markdown syntax, like the built index.
- Add a generated `skill.md` with agentskills.io and `skills` CLI discovery
  indexes, and the `agents.skill` option for your own skill file.
