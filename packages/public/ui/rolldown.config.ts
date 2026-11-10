import path from "node:path";
import { transformAsync } from "@babel/core";
import solid from "babel-preset-solid";
import { defineConfig, type Plugin } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const outputs = [
  ["client", "dom"],
  ["server", "ssr"]
] as const;

// Solid-aware bundlers use the JSX source; other consumers use compiled client and server outputs.
const solidOutputs = (): Plugin => ({
  name: "solid-outputs",
  async generateBundle(_options, bundle) {
    const entry = bundle["source/index.jsx"];

    if (!entry || entry.type !== "chunk") throw new Error("Build did not produce a JSX entry.");

    for (const [directory, generate] of outputs) {
      const result = await transformAsync(entry.code, {
        filename: "index.jsx",
        configFile: false,
        babelrc: false,
        presets: [[solid, { generate, hydratable: true }]],
        comments: false
      });

      if (typeof result?.code !== "string")
        throw new Error(`Build did not produce the ${directory} output.`);

      this.emitFile({ type: "asset", fileName: `${directory}/index.js`, source: result.code });
    }
  }
});

export default defineConfig({
  cwd: import.meta.dirname,
  input: { index: "src/solid/index.ts" },
  plugins: [dts({ cwd: import.meta.dirname }), solidOutputs()],
  platform: "neutral",
  tsconfig: "tsconfig.json",
  preserveEntrySignatures: "strict",
  external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
  output: {
    dir: "dist/solid",
    cleanDir: true,
    format: "esm",
    entryFileNames: (chunk) => (chunk.name.endsWith(".d") ? "types/[name].ts" : "source/[name].jsx")
  }
});
