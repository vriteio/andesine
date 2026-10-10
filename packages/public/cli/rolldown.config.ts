import { projectConfigSchema } from "./src/config/schema";
import path from "node:path";
import { chmod } from "node:fs/promises";
import { defineConfig } from "rolldown";
import { toJSONSchema } from "zod";
import { generateAPI } from "./scripts/generate-api";
import { readTemplate } from "./scripts/templates";

await generateAPI();

const templates = {
  pages: await readTemplate("pages"),
  extension: await readTemplate("extension")
};
// Private workspace packages are bundled; their dependencies are CLI dependencies.
const bundledPackages = ["@andesine/contracts", "@andesine/document", "@andesine/uno-preset"];

const isExternal = (id: string): boolean => {
  const isBundled = bundledPackages.some((name) => id === name || id.startsWith(`${name}/`));

  return !id.startsWith(".") && !path.isAbsolute(id) && !isBundled;
};

export default defineConfig({
  cwd: import.meta.dirname,
  input: { cli: "src/cli.ts" },
  platform: "node",
  tsconfig: "tsconfig.json",
  external: isExternal,
  plugins: [
    {
      name: "cli-package",
      generateBundle() {
        for (const [name, files] of Object.entries(templates)) {
          for (const file of files) {
            this.emitFile({
              type: "asset",
              fileName: `templates/${name}/${file.path}`,
              source: file.source
            });
          }
        }

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
