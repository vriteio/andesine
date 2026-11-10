# Andesine Pages template

A copyable Astro + Solid.js documentation site. You own the layouts, styles,
components, and configuration. `@andesine/pages` supplies the data layer and the
Astro integration. `@andesine/ui/solid` supplies headless components.

## Structure

| Path                     | Contents                                       |
| ------------------------ | ---------------------------------------------- |
| `andesine.config.ts`     | Site name, logo, brand colors, links, sources. |
| `astro.config.ts`        | Astro integrations.                            |
| `uno.config.ts`          | UnoCSS theme, layers, and transformers.        |
| `src/content.config.ts`  | Content collections for the sources.           |
| `src/content/docs/`      | The pages of the `docs` files source.          |
| `src/api/openapi.yaml`   | The example spec of the `api` OpenAPI source.  |
| `src/layouts/page.astro` | The page layout. It receives one `page` prop.  |
| `.env.example`           | The Andesine API key variable.                 |
| `src/styles/global.css`  | Fonts, base styles, and scrollbars.            |
| `src/components/`        | Styled primitives, layout, and API reference.  |

## Styles

The template uses the design language of the Andesine app:

- Component default classes start with `:base:` (or `:base-2:` for a component
  that wraps another one). UnoCSS compiles them into low-priority layers, so a
  `class` prop overrides them.
- `<html>` sets the brand gradient stops. Use `bg-gradient-to-tr` for a brand
  gradient on fills and icons (`i-*` classes). Add `bg-clip-text` and
  `text-transparent` for gradient text.
- The brand colors come from `brand` in `andesine.config.ts`.
- Hover styles use `@hover:` and are repeated with `focus-visible:`. There are no
  focus rings.
- UnoCSS also scans the files in `src/` directly. Astro and Solid escape `&`,
  `>`, and `'` in compiled class strings, so the compiled code alone can hide
  classes such as `[&[open]>summary]:rotate-90`.
- Headless behavior comes from `@andesine/ui/solid`. Visual effects, such as the
  outline guide, the tab indicator, and the page scroll shadows, are in
  `src/components/effects/`.

## Andesine content

To show a published Andesine collection, or to deploy the site, see
[Pages framework](https://andesine.app/docs/publishing/pages-framework/). The example pages in
`src/content/docs/` also explain the configuration, the components, and each host.

## Commands

Use Node.js 24 or later.

```sh
npm run check
npm run build
```
