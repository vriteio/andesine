import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";
import type { PagesConfig } from "../config";

interface VirtualModulesOptions {
  config: PagesConfig;
  configPath: string;
  layoutPath: string;
  componentsPath: string;
  socialCardPath: string;
  /** Astro's Shiki config; functions, such as transformers, are left out. */
  highlight: object;
}

const createConfigModule = (options: VirtualModulesOptions): string => {
  const { config, configPath } = options;
  const imports: string[] = [];
  const assignments: string[] = [];
  const importAsset = (target: string, value?: string): void => {
    if (!value || !/^\.\.?\//.test(value)) return;

    const name = `asset${imports.length}`;
    const path = resolve(dirname(configPath), value);

    imports.push(`import ${name} from ${JSON.stringify(`${path}?url&no-inline`)};`);
    assignments.push(`${target} = ${name};`);
  };

  importAsset("config.logo.src", config.logo?.src);
  importAsset("config.favicon", config.favicon);
  importAsset("config.social.image", config.social.image);

  return [
    ...imports,
    `const config = ${JSON.stringify(config)};`,
    ...assignments,
    `export const highlight = ${JSON.stringify(options.highlight)};`,
    config.agents.skill
      ? `export { default as skill } from ${JSON.stringify(`${resolve(dirname(configPath), config.agents.skill)}?raw`)};`
      : "export const skill = undefined;",
    "export default config;"
  ].join("\n");
};
/** The template's social card, with the card images as data URLs. */
const createSocialModule = (options: VirtualModulesOptions): string => {
  const { config, configPath } = options;
  // Only files next to the config can be inlined; the card leaves out other images.
  const toImport = (name: string, value?: string): string => {
    if (!value || !/^\.\.?\//.test(value)) return `const ${name} = undefined;`;

    const path = resolve(dirname(configPath), value);

    return `import ${name} from ${JSON.stringify(`${path}?inline`)};`;
  };

  if (!config.social.generate) return "export default {};";

  return [
    `import card from ${JSON.stringify(options.socialCardPath)};`,
    toImport("logo", config.logo?.src),
    toImport("background", config.social.background),
    "export default { card, logo, background };"
  ].join("\n");
};
const virtualModules = (options: VirtualModulesOptions): Plugin => {
  const modules: Record<string, () => string> = {
    "virtual:andesine/config": () => createConfigModule(options),
    "virtual:andesine/layout": () => {
      return `export { default } from ${JSON.stringify(options.layoutPath)};`;
    },
    "virtual:andesine/components": () => {
      return existsSync(options.componentsPath)
        ? `export { components } from ${JSON.stringify(options.componentsPath)};`
        : "export const components = {};";
    },
    "virtual:andesine/social": () => createSocialModule(options)
  };

  return {
    name: "andesine-pages-virtual-modules",
    resolveId(id) {
      if (id in modules) return `\0${id}`;
    },
    load(id) {
      if (id.startsWith("\0")) return modules[id.slice(1)]?.();
    }
  };
};

export { virtualModules };
