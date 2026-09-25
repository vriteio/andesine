# Andesine edge router

Cloudflare Worker that serves the landing page at `/`, landing assets and legal pages,
and proxies all other paths to the Railway web app.

Copy `.dev.vars.example` to `.dev.vars` when local origin addresses differ. Then run:

```sh
pnpm dev --filter=@andesine/edge
```

The command builds the landing app, then starts the edge Worker at `http://localhost:8787`.

Run `pnpm deploy:edge` to build the landing app, check the edge Worker, and deploy it.
After the first edge deployment, set `APP_ORIGIN` to the Railway service origin
and `API_ORIGIN` to the production Andesine API in the Cloudflare Worker settings. Wrangler keeps
dashboard-managed variables during later deployments.
