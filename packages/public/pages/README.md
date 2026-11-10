# @andesine/pages

The Astro integration and data layer of Andesine Pages, a documentation site framework. Pages
shows content from an [Andesine](https://andesine.app) collection, local Markdown and MDX files,
and OpenAPI specs, with search, AI answers, and Markdown versions of each page for AI agents.

Use it with the Pages template, which supplies the layouts, styles, and components.

## Install

```sh
npx andesine pages init docs
cd docs
npm install
npm run dev
```

The command copies the template, with `@andesine/pages` and `@andesine/ui` pinned to the same
version.

> **0.x.** The config and the page context can change in minor releases; the changelog lists the
> changes. Use the version that the template pins.

## Documentation

- [Pages framework](https://andesine.app/docs/publishing/pages-framework/)
- [Hosted sites](https://andesine.app/docs/publishing/hosted-sites/), to host a site without code

## License

MIT
