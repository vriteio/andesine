# Andesine documentation

Nimbus-based Astro documentation served publicly below `/docs/`. The static build includes
search, sitemap, Open Graph images, Markdown alternatives, and `llms.txt`.

```sh
pnpm --filter @andesine/docs dev
pnpm --filter @andesine/docs build
pnpm --filter @andesine/docs typecheck
pnpm --filter @andesine/docs lint:docs
```

The development command loads the root `.env` and listens on all network interfaces on port 4322.
Like the web and landing apps, it reads `HTTPS_KEY_PATH` and `HTTPS_CERT_PATH` from that file. With
the existing local certificate, open
`https://macbook-pro.local:4322/docs/overview/`. Both certificate paths must be set together.

The Cloudflare Worker is named `andesine-docs`. It has no public `workers.dev` route and is called
by the `andesine-edge` Worker through a service binding. Deploy this Worker before the edge Worker.

Add documentation pages to `src/content/docs`. Nimbus creates navigation from the filesystem.
