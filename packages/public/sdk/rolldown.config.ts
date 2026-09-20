import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig({
  cwd: import.meta.dirname,
  input: { index: "src/index.ts", streaming: "src/streaming.ts" },
  plugins: [dts({ cwd: import.meta.dirname })],
  platform: "neutral",
  tsconfig: "tsconfig.json",
  preserveEntrySignatures: "strict",
  external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
  output: {
    dir: "dist",
    cleanDir: true,
    format: "esm",
    entryFileNames: "[name].js",
    sourcemap: true
  }
});
