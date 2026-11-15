import { defineConfig } from "unocss";
import webConfig from "../web/uno.config";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const componentsRoot = fileURLToPath(
  new URL("../../packages/private/components/src", import.meta.url)
);

// Reuse the app's colors, icons, layers, and shared component transformers.
export default defineConfig({
  ...webConfig,
  content: {
    // Icon names in navigation.ts; other plain .ts files stay out, as transforming them changes compiled classes.
    pipeline: {
      include: [/\.(vue|svelte|[jt]sx|mdx?|astro|html)($|\?)/, /\/navigation\.ts($|\?)/]
    },
    filesystem: [
      `${projectRoot}src/**/*.{astro,ts,tsx,scss}`,
      `${componentsRoot}/**/*.{ts,tsx,scss}`
    ]
  }
});
