import { existsSync } from "node:fs";
import { runnerImport } from "vite";
import { parseConfig, type PagesConfig } from "../config";

interface LoadedConfig {
  config: PagesConfig;
  /** Imported local files, for development reloads. */
  dependencies: string[];
}

const loadConfig = async (path: string): Promise<LoadedConfig> => {
  if (!existsSync(path)) throw new Error(`Andesine Pages config not found: ${path}`);

  const { module, dependencies } = await runnerImport<{ default?: unknown }>(path);

  return { config: parseConfig(module.default, path), dependencies };
};

export { loadConfig };
