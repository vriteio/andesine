import { readFileSync, globSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "rolldown";
import { dts } from "rolldown-plugin-dts";

// Astro compiles .astro files in the consumer project; copy them next to the bundled entries.
const astroFiles = (): Plugin => ({
  name: "astro-files",
  generateBundle() {
    for (const file of globSync("astro/**/*.astro", {
      cwd: path.join(import.meta.dirname, "src")
    })) {
      this.emitFile({
        type: "asset",
        fileName: file,
        source: readFileSync(path.join(import.meta.dirname, "src", file), "utf8")
      });
    }
  }
});

export default defineConfig([
  {
    cwd: import.meta.dirname,
    input: {
      "index": "src/index.ts",
      "integration": "src/integration.ts",
      "collections": "src/collections.ts",
      "astro": "src/astro.ts",
      "client": "src/client.ts",
      "astro/routes/search": "src/astro/routes/search.ts",
      "astro/routes/answers": "src/astro/routes/answers.ts",
      "astro/middleware": "src/astro/middleware.ts",
      "astro/routes/markdown": "src/astro/routes/markdown.ts",
      "astro/routes/live-markdown": "src/astro/routes/live-markdown.ts",
      "astro/routes/markdown-alias": "src/astro/routes/markdown-alias.ts",
      "astro/routes/live-markdown-alias": "src/astro/routes/live-markdown-alias.ts",
      "astro/routes/llms-full": "src/astro/routes/llms-full.ts",
      "astro/routes/skill": "src/astro/routes/skill.ts",
      "astro/routes/skills": "src/astro/routes/skills.ts",
      "astro/routes/social": "src/astro/routes/social.ts",
      "astro/routes/live-social": "src/astro/routes/live-social.ts",
      "astro/routes/well-known-llms": "src/astro/routes/well-known-llms.ts",
      "astro/routes/sitemap": "src/astro/routes/sitemap.ts",
      "astro/routes/llms": "src/astro/routes/llms.ts",
      "astro/routes/robots": "src/astro/routes/robots.ts",
      "runtime": "src/runtime.ts"
    },
    plugins: [dts({ cwd: import.meta.dirname }), astroFiles()],
    platform: "node",
    tsconfig: "tsconfig.json",
    preserveEntrySignatures: "strict",
    external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
    output: {
      dir: "dist",
      cleanDir: true,
      format: "esm",
      entryFileNames: "[name].js",
      chunkFileNames: "chunks/[name]-[hash].js",
      sourcemap: true
    }
  },
  // A standalone script that the integration inlines into each page's `<head>`.
  {
    cwd: import.meta.dirname,
    input: { "scripts/restore-navigation": "src/scripts/restore-navigation.ts" },
    platform: "browser",
    tsconfig: "tsconfig.json",
    output: { dir: "dist", format: "iife", entryFileNames: "[name].js", minify: true }
  }
]);
