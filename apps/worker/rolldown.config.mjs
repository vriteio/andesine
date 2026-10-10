import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "rolldown";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const externals = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`)
]);

export default defineConfig({
  cwd: __dirname,
  input: {
    "index": "./src/index.ts",
    "refresh-extension-registry": "./src/refresh-extension-registry.ts"
  },
  platform: "node",
  tsconfig: "./tsconfig.json",
  external(id) {
    if (id.startsWith("@andesine/")) {
      return false;
    }

    return externals.has(id) || (!id.startsWith(".") && !path.isAbsolute(id));
  },
  output: {
    dir: path.resolve(__dirname, "dist"),
    entryFileNames: "[name].js",
    format: "esm",
    sourcemap: false
  }
});
