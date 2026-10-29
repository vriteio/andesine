# Andesine edge router

Cloudflare Worker that serves the landing page at `/`, landing assets and legal pages,
and proxies all other paths to the Railway web app. When `PUBLIC_POSTHOG_HOST` is a path (for
example `/relay`) and `POSTHOG_HOST` is set, requests under that path go to PostHog through our own
domain, so ad blockers that block PostHog's hosts don't drop client analytics. Use the same values
as the web app and landing page builds.

Copy `.dev.vars.example` to `.dev.vars` when local origin addresses differ. Then run:

```sh
pnpm dev:edge
```

The command builds the landing app, then starts the edge Worker at `http://localhost:43212`.

Run `pnpm deploy:edge` to build the landing app, check the edge Worker, and deploy it.
After the first edge deployment, set `APP_ORIGIN` to the Railway service origin
and `API_ORIGIN` to the production Andesine API in the Cloudflare Worker settings, and, for the relay,
`POSTHOG_HOST` and `PUBLIC_POSTHOG_HOST`. Wrangler keeps
dashboard-managed variables during later deployments.
