import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import unoCSS from "unocss/vite";
import { VitePWA } from "vite-plugin-pwa";

// The Cloudflare Worker bundles all dependencies with their worker builds; Node keeps them external.
const isWorkerBuild = process.env.BUILD_TARGET === "worker";

export default defineConfig(({ isSsrBuild }) => ({
  envPrefix: "PUBLIC_",
  worker: { format: "es" },
  build: {
    rollupOptions: {
      input: isSsrBuild ? undefined : { app: "index.html", offline: "offline.html" },
      external: isWorkerBuild ? [/^node:/] : undefined,
      // Lazy parts, e.g. icon sets, stay separate modules that load only when used.
      output: isWorkerBuild ? { codeSplitting: true } : undefined
    },
    copyPublicDir: !isWorkerBuild
  },
  ssr: isWorkerBuild
    ? {
        target: "webworker",
        noExternal: true,
        resolve: { conditions: ["workerd", "worker", "module", "production"] }
      }
    : {
        noExternal: [
          /^@andesine\//,
          /^@atlaskit\/pragmatic-drag-and-drop(?:$|\/)/,
          /^@atlaskit\/pragmatic-drag-and-drop-hitbox(?:$|\/)/
        ]
      },
  plugins: [
    unoCSS(),
    solid({ ssr: true }),
    VitePWA({
      disable: isSsrBuild,
      strategies: "injectManifest",
      srcDir: "src/service-worker",
      filename: "service-worker.ts",
      injectRegister: false,
      manifest: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "manifest.json", "*.woff2"],
      injectManifest: {
        globPatterns: ["offline.html", "assets/**/*.{js,css,woff,woff2,svg,png,webp,avif}"],
        // Icon sets load on use in icon pickers; Simple Icons is over the size limit.
        globIgnores: ["**/*.map", "assets/{lucide,tabler,simple-icons}-*.js"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  resolve: { tsconfigPaths: true },
  server: { allowedHosts: [".local"] }
}));
