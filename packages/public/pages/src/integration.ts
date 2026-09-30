import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { PagesConfig } from "./config";
import { mdxComponents } from "./content/mdx-components";
import { shikiCodeTitle } from "./content/shiki-code-title";
import { copyAssets, serveAssets } from "./integration/assets";
import { loadConfig } from "./integration/load-config";
import { servePagefind } from "./integration/pagefind-dev";
import { virtualModules } from "./integration/virtual-modules";
import { writePagefindIndex } from "./search/pagefind";

interface AndesineOptions {
  /** Relative to the project root. */
  config?: string;
  /** Astro layout that renders each page. Relative to the project root. */
  layout?: string;
  /** Module that exports the `components` for page content. Relative to the project root. */
  components?: string;
  /** Module that exports the social card for generated page images. Relative to the project root. */
  socialCard?: string;
}

interface MarkdownProcessor {
  name: string;
  options: { mdastPlugins?: unknown[] };
}

const socialRenderers = ["satori", "@resvg/resvg-js"];
const pageLists = {
  "/sitemap.xml": "sitemap",
  "/llms.txt": "llms",
  "/llms-full.txt": "llms-full",
  "/.well-known/llms.txt": "well-known-llms",
  "/skill.md": "skill",
  "/.well-known/[...path]": "skills"
};

const getBuildSourceIDs = (config: PagesConfig): string[] => {
  return config.sources.filter((source) => source.type === "andesine").map((source) => source.id);
};
const andesine = (options: AndesineOptions = {}): AstroIntegration => {
  let config: PagesConfig;
  let cache: URL;
  let output: URL;

  return {
    name: "@andesine/pages",
    hooks: {
      "astro:config:setup": async ({
        config: astroConfig,
        updateConfig,
        injectRoute,
        injectScript,
        addMiddleware,
        addWatchFile,
        logger
      }) => {
        const root = fileURLToPath(astroConfig.root);
        const configPath = resolve(root, options.config ?? "andesine.config.ts");
        const layoutPath = resolve(root, options.layout ?? "src/layouts/page.astro");
        const componentsPath = resolve(
          root,
          options.components ?? "src/components/content/index.ts"
        );
        const socialCardPath = resolve(root, options.socialCard ?? "src/components/social/card.ts");
        const loaded = await loadConfig(configPath);
        const { dependencies } = loaded;
        const processor = astroConfig.markdown.processor as MarkdownProcessor | undefined;
        const isCloudflare = astroConfig.adapter?.name === "@astrojs/cloudflare";

        config = loaded.config;
        // Without a social card, pages use the default image.
        config.social.generate &&= existsSync(socialCardPath);
        [configPath, ...dependencies].forEach((path) => addWatchFile(path));

        // Astro keeps processor options mutable, so integrations can add plugins.
        if (processor?.name === "satteri") {
          processor.options.mdastPlugins = [
            ...(processor.options.mdastPlugins ?? []),
            mdxComponents
          ];
        } else {
          logger.warn("MDX content components need the Sätteri Markdown processor.");
        }

        updateConfig({
          site: config.site,
          base: config.base,
          markdown: { shikiConfig: { transformers: [shikiCodeTitle] } },
          vite: {
            plugins: [
              virtualModules({
                config,
                configPath,
                layoutPath,
                componentsPath,
                socialCardPath,
                highlight: astroConfig.markdown.shikiConfig
              })
            ],
            ssr: { noExternal: ["@andesine/pages"] },
            // The social image renderers load native and WebAssembly code, so they stay outside
            // the server bundles. The site installs them. Cloudflare does not allow externals.
            environments: isCloudflare
              ? {}
              : {
                  ssr: { resolve: { external: socialRenderers } },
                  prerender: { resolve: { external: socialRenderers } }
                },
            optimizeDeps: { exclude: socialRenderers }
          }
        });

        // Restores saved navigation tree groups before the first paint; see the script's source.
        injectScript(
          "head-inline",
          readFileSync(new URL("./scripts/restore-navigation.js", import.meta.url), "utf8")
        );

        addMiddleware({
          entrypoint: new URL("./astro/middleware.js", import.meta.url),
          order: "pre"
        });

        injectRoute({
          pattern: "/[...path]",
          entrypoint: new URL("./astro/routes/static.astro", import.meta.url),
          prerender: true
        });
        injectRoute({
          pattern: "/[...path]/index.md",
          entrypoint: new URL("./astro/routes/markdown.js", import.meta.url),
          prerender: true
        });
        injectRoute({
          pattern: "/[...path].md",
          entrypoint: new URL("./astro/routes/markdown-alias.js", import.meta.url),
          prerender: true
        });

        if (config.social.generate) {
          injectRoute({
            pattern: "/[...path]/social.png",
            entrypoint: new URL("./astro/routes/social.js", import.meta.url),
            prerender: true
          });
        }

        for (const [pattern, name] of Object.entries(pageLists)) {
          injectRoute({
            pattern,
            entrypoint: new URL(`./astro/routes/${name}.js`, import.meta.url),
            prerender: true
          });
        }

        injectRoute({
          pattern: "/robots.txt",
          entrypoint: new URL("./astro/routes/robots.js", import.meta.url),
          prerender: true
        });
        injectRoute({
          pattern: "/404",
          entrypoint: new URL("./astro/routes/not-found.astro", import.meta.url),
          prerender: true
        });

        // Andesine search keeps the API key on the server, so it needs a server route.
        if (config.sources.some((source) => source.type === "andesine")) {
          injectRoute({
            pattern: "/_andesine/search",
            entrypoint: new URL("./astro/routes/search.js", import.meta.url),
            prerender: false
          });
        }

        if (config.sources.some((source) => source.type === "andesine" && source.answers)) {
          injectRoute({
            pattern: "/_andesine/answers",
            entrypoint: new URL("./astro/routes/answers.js", import.meta.url),
            prerender: false
          });
        }
      },
      "astro:config:done": ({ config: astroConfig, buildOutput }) => {
        cache = astroConfig.cacheDir;
        output = buildOutput === "server" ? astroConfig.build.client : astroConfig.outDir;
      },
      "astro:server:setup": ({ server }) => {
        const runtime = fileURLToPath(new URL("./runtime.js", import.meta.url));

        serveAssets(server, cache, config.base, getBuildSourceIDs(config));
        servePagefind(server, config.base, async () => {
          return (await server.ssrLoadModule(runtime)).getSearchRecords(config);
        });
      },
      "astro:build:done": async ({ logger }) => {
        await copyAssets(cache, output, getBuildSourceIDs(config));

        if (config.sources.some((source) => source.type !== "andesine")) {
          await writePagefindIndex(fileURLToPath(output));
          logger.info("Wrote the local search index.");
        }
      }
    }
  };
};

export { andesine };
export type { AndesineOptions };
