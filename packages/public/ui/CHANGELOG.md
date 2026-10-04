# Changelog

## 0.4.0

First release. The version follows the other Andesine packages.

- Add the package structure and the `@andesine/ui/solid` export.
- Add `NavigationTree`, `TableOfContents`, `MobileNavigation`, `Breadcrumbs`, and
  `Pagination`.
- Add `Tabs` with shared selection, and `createClipboard`.
- Add `createSearch` and `createListNavigation`.
- Add `createAnswer` for streamed answers with follow-ups and cancellation.
- Add `createPageActions` to copy the page link or its Markdown.
- Add `createSearchPalette`, `createPageScrollbar`, `createScrollEdges`,
  `createScrollMemory`, `createTabIndicator`, `createTableOfContentsGuide`, and
  the match helpers `splitMatches`, `matchesQuery`, and `getMatchPreview`.
- `NavigationTree` saves the expanded groups of each page, reads them before
  hydration, and has `defaultDepth`. Its root has `data-storage-key`, which the
  `@andesine/pages` restore script uses.
