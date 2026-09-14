import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import nimbus, { defineConfig as defineNimbusConfig } from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const httpsKeyPath = process.env.HTTPS_KEY_PATH;
const httpsCertPath = process.env.HTTPS_CERT_PATH;
const hasIncompleteHTTPSConfig = Boolean(httpsKeyPath) !== Boolean(httpsCertPath);

if (hasIncompleteHTTPSConfig) {
  throw new Error("HTTPS_KEY_PATH and HTTPS_CERT_PATH must be set together");
}

const nimbusConfig = defineNimbusConfig({
  site: "https://andesine.app",
  title: "Andesine Docs",
  description: "Learn how to write, structure, and publish content with Andesine.",
  locale: "en",
  github: "https://github.com/vriteio/andesine",
  editPattern: "https://github.com/vriteio/andesine/edit/main/apps/docs/{path}",
  socialImageAlt: "Andesine documentation preview"
});

export default defineConfig({
  base: "/docs",
  site: "https://andesine.app",
  // nimbus:adapter
  output: "static",
  server: { host: true, port: 4322, allowedHosts: [".local"] },
  // Tailwind v4 via its Vite plugin (the integration Astro recommends for
  // Tailwind v4 — replaces the PostCSS plugin, which doesn't build under
  // Astro 7's Vite 8 bundler).
  vite: {
    plugins: [tailwindcss()],
    server: {
      ...(httpsKeyPath &&
        httpsCertPath && {
          https: {
            key: fs.readFileSync(path.resolve(repositoryRoot, httpsKeyPath)),
            cert: fs.readFileSync(path.resolve(repositoryRoot, httpsCertPath))
          }
        })
    }
  },
  // Hover-prefetch link targets so full-page navigations feel instant without
  // a client-side router.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover"
  },
  integrations: [
    nimbus(nimbusConfig, {
      // Authoring rules are opt-in by design — your repo, your taste. The
      // two below are the load-bearing pair: frontmatter has to validate
      // against the content schema for the page to render properly, and
      // broken internal links are 404s for your readers. Add the others
      // (heading hierarchy, code-block language, style, etc.) when you're
      // ready to enforce them — see `nimbus-docs lint --help`.
      rules: {
        "nimbus/frontmatter-shape": "error",
        "nimbus/internal-link": "error"
      },
      // Wrap wide tables so they scroll instead of overflowing the page
      // (styled by `.nb-table-scroll` in src/styles/prose.css).
      markdown: {
        hastPlugins: [tableScroll()]
      }
    })
  ]
});
