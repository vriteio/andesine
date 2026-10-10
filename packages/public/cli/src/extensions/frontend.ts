import type { ExtensionManifest } from "@andesine/contracts/extensions/manifest";
import { transformAsync } from "@babel/core";
import { createRequire } from "node:module";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { build, type Plugin } from "rolldown";
import { transformSync } from "rolldown/utils";
import { CLIError, exitCodes } from "../errors";

interface FrontendBundle {
  code: string;
  /** The code of the project's own modules, which utility and icon classes are read from. */
  sources: string;
}

const ENTRY_ID = "\0andesine-extension-entry";
const require = createRequire(import.meta.url);

/** The view entries that the manifest names, in manifest order. */
const getEntries = (manifest: ExtensionManifest): string[] => {
  const entries = [
    ...manifest.elementViews.flatMap((view) => [
      view.entry,
      ...view.descendants.map(({ entry }) => entry)
    ]),
    ...manifest.blockActions.map(({ entry }) => entry),
    ...manifest.panels.map(({ entry }) => entry)
  ];

  return [...new Set(entries)];
};
/** Generates the `startExtension` call; a missing export fails the build. */
const createEntryPlugin = (module: string, entries: string[]): Plugin => {
  const imports = entries.map((entry, index) => `${entry} as view${index}`).join(", ");
  const views = entries.map((entry, index) => `${entry}: view${index}`).join(", ");

  return {
    name: "andesine-extension-entry",
    resolveId: (id) => (id === ENTRY_ID ? id : null),
    load: (id) => {
      if (id !== ENTRY_ID) return null;

      return [
        entries.length ? `import { ${imports} } from ${JSON.stringify(module)};` : "",
        `import { startExtension } from "@andesine/extensions/solid";`,
        `startExtension({ ${views} });`
      ].join("\n");
    }
  };
};
/** Strips TypeScript, then compiles JSX for the extension renderer. */
const solidPlugin: Plugin = {
  name: "andesine-extension-solid",
  transform: {
    filter: { id: /\.[jt]sx$/ },
    handler: async (code, id) => {
      const stripped = transformSync(id, code, { jsx: "preserve" });

      if (stripped.errors.length) throw stripped.errors[0];

      const result = await transformAsync(stripped.code, {
        filename: id,
        babelrc: false,
        configFile: false,
        presets: [
          [
            require.resolve("babel-preset-solid"),
            { generate: "universal", moduleName: "@andesine/extensions/solid" }
          ]
        ]
      });

      return { code: result?.code ?? "" };
    }
  }
};

/** Bundles the frontend into one classic script for the extension worker. */
const bundleFrontend = async (
  root: string,
  manifest: ExtensionManifest,
  frontend: string,
  onWarning: (message: string) => void
): Promise<FrontendBundle> => {
  const entries = getEntries(manifest);
  const module = path.resolve(root, frontend);
  const { output } = await build({
    cwd: root,
    input: ENTRY_ID,
    platform: "browser",
    plugins: [createEntryPlugin(module, entries), solidPlugin],
    transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
    write: false,
    onLog: (level, log, handler) => {
      // An unresolved import would become a global that the worker does not have.
      if (log.code === "UNRESOLVED_IMPORT") handler("error", log);
      else if (level === "warn") onWarning(log.message);
    },
    output: { format: "iife", codeSplitting: false, minify: true }
  }).catch((error: Error & { errors?: Array<{ message: string }> }) => {
    const messages = (error.errors?.map(({ message }) => message) ?? [error.message]).map(
      stripVTControlCharacters
    );

    throw new CLIError(`The frontend build failed:\n${messages.join("\n")}`, exitCodes.failure);
  });
  const [chunk] = output;
  const isProjectModule = (id: string): boolean => {
    return id.startsWith(root + path.sep) && !id.includes(`${path.sep}node_modules${path.sep}`);
  };
  const sources = Object.entries(chunk.modules)
    .filter(([id]) => isProjectModule(id))
    .map(([, rendered]) => rendered.code ?? "");

  return { code: chunk.code, sources: sources.join("\n") };
};

export { bundleFrontend };
