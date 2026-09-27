# @andesine/ui

Headless documentation components for Andesine Pages. The components supply
structure, state, keyboard and focus behavior, and ARIA attributes. They supply
no styles.

## Exports

| Export               | Contents             |
| -------------------- | -------------------- |
| `@andesine/ui/solid` | Solid.js components. |

## Components

| Component              | Behavior                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NavigationTree`       | Page links and groups. Link activation does not expand a group. Expanded groups persist in session storage, shared by trees with the same key. |
| `TableOfContents`      | Heading links. Tracks the current heading and the headings in view, and moves focus after a click.                                             |
| `MobileNavigation`     | A `<details>` menu that is modal while open, and works without JavaScript.                                                                     |
| `Breadcrumbs`          | Ancestor links.                                                                                                                                |
| `Tabs`                 | Ark UI tabs. Tabs with the same `syncKey` share their selection.                                                                               |
| `createClipboard`      | Copies text and reports success or failure for a short time.                                                                                   |
| `createSearch`         | Debounced search. A new query cancels the previous request, and only the latest response updates the results.                                  |
| `createListNavigation` | Arrow, Home, End, and Enter keys for a list, e.g. from a combobox input.                                                                       |
| `Pagination`           | Previous and next links.                                                                                                                       |

The table of contents reads the document's `scroll-padding-top` as the height of
sticky headers.

Each component part renders `data-scope` and `data-part` attributes. State is in
`data-*` and ARIA attributes. Use these attributes to style the parts.

## Build

```sh
pnpm build --filter=@andesine/ui
```

The Solid export has 4 conditions: `solid` (JSX source for Solid-aware bundlers),
`browser`, `node`, and `types`.
