import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import solid from "@astrojs/solid-js";
import unoCSS from "@unocss/astro";
import { andesine } from "@andesine/pages/integration";
import config from "./andesine.config";

export default defineConfig({
  // Andesine sources need a server for search and request-time pages; other sites are static.
  adapter: config.sources.some((source) => source.type === "andesine")
    ? node({ mode: "standalone" })
    : undefined,
  server: { host: true, allowedHosts: [".local"] },
  markdown: { shikiConfig: { theme: "github-light" } },
  integrations: [mdx(), solid(), unoCSS(), andesine()]
});
