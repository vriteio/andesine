import { projectConfigSchema } from "./src/config/schema";
import path from "node:path";
import { chmod } from "node:fs/promises";
import { defineConfig } from "rolldown";
import { toJSONSchema } from "zod";
import { generateAPI } from "./scripts/generate-api";

await generateAPI();

export default defineConfig({
  cwd: import.meta.dirname,
  input: { cli: "src/cli.ts" },
  platform: "node",
  tsconfig: "tsconfig.json",
  external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
  plugins: [
    {
      name: "cli-package",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "config.schema.json",
          source: `${JSON.stringify(toJSONSchema(projectConfigSchema, { io: "input" }), null, 2)}\n`
        });
      },
      async writeBundle() {
        await chmod(path.join(import.meta.dirname, "dist/cli.js"), 0o755);
      }
    }
  ],
  output: {
    dir: "dist",
    cleanDir: true,
    format: "esm",
    entryFileNames: "[name].js",
    sourcemap: true
  }
});
