import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig({
  cwd: import.meta.dirname,
  input: { index: "src/index.ts", solid: "src/solid.ts" },
  plugins: [dts({ cwd: import.meta.dirname, eager: true })],
  platform: "browser",
  tsconfig: "tsconfig.json",
  preserveEntrySignatures: "strict",
  // Solid and Zod stay external, so extensions have one copy; private contracts are bundled.
  external: (id) => {
    return !id.startsWith(".") && !path.isAbsolute(id) && !id.startsWith("@andesine/contracts");
  },
  output: {
    dir: "dist",
    cleanDir: true,
    format: "esm",
    entryFileNames: "[name].js",
    sourcemap: true
  }
});
