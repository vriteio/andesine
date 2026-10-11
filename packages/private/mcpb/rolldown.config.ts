import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "rolldown";
import { version } from "./package.json";

const manifest = JSON.parse(
  await readFile(path.join(import.meta.dirname, "manifest.json"), "utf8")
);
const icon = await readFile(
  path.join(import.meta.dirname, "../../../release/directory/icon-512.png")
);
const license = await readFile(path.join(import.meta.dirname, "LICENSE"), "utf8");

// One self-contained server file; Claude Desktop runs it with its own Node.js.
export default defineConfig({
  cwd: import.meta.dirname,
  input: { index: "src/server.ts" },
  platform: "node",
  tsconfig: "tsconfig.json",
  plugins: [
    {
      name: "mcpb-package",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: `${JSON.stringify({ ...manifest, version }, null, 2)}\n`
        });
        this.emitFile({ type: "asset", fileName: "icon.png", source: icon });
        this.emitFile({ type: "asset", fileName: "LICENSE", source: license });
      }
    }
  ],
  output: {
    dir: "dist",
    cleanDir: true,
    format: "esm",
    entryFileNames: "server/[name].js"
  }
});
