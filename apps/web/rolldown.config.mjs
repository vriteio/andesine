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
  input: "./src/server/index.ts",
  platform: "node",
  transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
  tsconfig: "./tsconfig.json",
  resolve: {
    alias: {
      "#web": path.resolve(__dirname, "src")
    }
  },
  external(id) {
    if (id.startsWith("@andesine/")) {
      return false;
    }

    if (externals.has(id)) {
      return true;
    }

    return !id.startsWith(".") && !path.isAbsolute(id) && !id.startsWith("#web/");
  },
  output: {
    file: path.resolve(__dirname, "dist/server/index.js"),
    format: "esm",
    sourcemap: false
  }
});
