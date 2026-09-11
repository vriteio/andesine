import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import unoCSS from "unocss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ isSsrBuild }) => ({
  envPrefix: "PUBLIC_",
  worker: { format: "es" },
  build: {
    rollupOptions: {
      input: isSsrBuild ? undefined : { app: "index.html", offline: "offline.html" }
    }
  },
  ssr: {
    noExternal: [
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
        globIgnores: ["**/*.map"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  resolve: { tsconfigPaths: true },
  server: { allowedHosts: [".local"] }
}));
