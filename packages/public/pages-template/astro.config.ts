import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import solid from "@astrojs/solid-js";
import unoCSS from "@unocss/astro";
import { andesine } from "@andesine/pages/integration";
import config from "./andesine.config";

export default defineConfig({
  // Andesine sources without a publishable key need a server for search and AI answers.
  adapter: config.sources.some((source) => source.type === "andesine" && !source.publicKey)
    ? node({ mode: "standalone" })
    : undefined,
  server: { host: true, allowedHosts: [".local"] },
  markdown: { shikiConfig: { theme: "github-light" } },
  integrations: [
    mdx(),
    solid(),
    // The reset loads just before the UnoCSS rules; utilities then override it in every build.
    unoCSS({ injectReset: "@unocss/reset/tailwind.css" }),
    andesine()
  ]
});
