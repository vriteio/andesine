# Andesine edge router

Cloudflare Worker that serves the landing page at `/`, forwards `/docs/*` to the Nimbus docs
Worker, and proxies all other paths to the Railway web app.

Copy `.dev.vars.example` to `.dev.vars` when local origin addresses differ. Then run:

```sh
pnpm --filter @andesine/edge dev
```

The command builds the landing and docs apps, then starts both Workers locally. The edge Worker
is the primary service at `http://localhost:8787`.

Deploy `@andesine/docs` before `@andesine/edge` because the edge Worker has a service binding to
`andesine-docs`. After the first edge deployment, set `APP_ORIGIN` to the Railway service origin
and `API_ORIGIN` to the production Andesine API in the Cloudflare Worker settings. Wrangler keeps
dashboard-managed variables during later deployments.
