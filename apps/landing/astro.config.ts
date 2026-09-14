import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import unoCSS from "@unocss/astro";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const httpsKeyPath = process.env.HTTPS_KEY_PATH;
const httpsCertPath = process.env.HTTPS_CERT_PATH;
const hasIncompleteHTTPSConfig = Boolean(httpsKeyPath) !== Boolean(httpsCertPath);

if (hasIncompleteHTTPSConfig) {
  throw new Error("HTTPS_KEY_PATH and HTTPS_CERT_PATH must be set together");
}

export default defineConfig({
  site: "https://andesine.app",
  output: "static",
  build: { assets: "_landing" },
  server: { host: true, port: 4321, allowedHosts: [".local"] },
  integrations: [unoCSS(), solid()],
  build: {
    assets: "_landing"
  },
  vite: {
    ssr: { noExternal: ["@andesine/components"] },
    resolve: { tsconfigPaths: true },
    server: {
      ...(httpsKeyPath &&
        httpsCertPath && {
          https: {
            key: fs.readFileSync(path.resolve(repositoryRoot, httpsKeyPath)),
            cert: fs.readFileSync(path.resolve(repositoryRoot, httpsCertPath))
          }
        })
    }
  }
});
