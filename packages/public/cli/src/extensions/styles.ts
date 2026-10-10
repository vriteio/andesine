import type { ExtensionManifest } from "@andesine/contracts/extensions/manifest";
import { ExtensionStyleError } from "@andesine/contracts/extensions/styles";
import {
  DEFAULT_ICON_SETS,
  type ExtensionViewCSSOptions,
  generateExtensionCSS,
  generateExtensionIconCSS
} from "@andesine/uno-preset/extensions";
import { FileSystemIconLoader } from "@iconify/utils/lib/loader/node-loaders";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { CLIError, exitCodes } from "../errors";
import { exists } from "./project";

interface ExtensionStyles {
  styles: string;
  icons: string;
}

type IconCollections = ExtensionViewCSSOptions["icons"];

const ICON_SET_PACKAGE = "@iconify-json/";

const readJSON = async (file: string) => JSON.parse(await readFile(file, "utf8"));
/** Sets of a package resolver, loaded when the CSS uses them. */
const loadPackageSets = (sets: string[], require: NodeJS.Require): IconCollections => {
  return Object.fromEntries(
    sets.map((set) => [
      set,
      () => readJSON(require.resolve(`${ICON_SET_PACKAGE}${set}/icons.json`))
    ])
  );
};
/** Default sets from the CLI, sets installed in the project, then custom SVG directories. */
const loadIconCollections = async (
  root: string,
  custom: Record<string, string> = {}
): Promise<IconCollections> => {
  const manifestPath = path.join(root, "package.json");
  const manifest = (await exists(manifestPath)) ? await readJSON(manifestPath) : {};
  const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter((name) => name.startsWith(ICON_SET_PACKAGE))
    .map((name) => name.slice(ICON_SET_PACKAGE.length));

  return {
    ...loadPackageSets(DEFAULT_ICON_SETS, createRequire(import.meta.url)),
    ...loadPackageSets(installed, createRequire(manifestPath)),
    ...Object.fromEntries(
      Object.entries(custom).map(([set, directory]) => {
        return [set, FileSystemIconLoader(path.resolve(root, directory))];
      })
    )
  };
};
const getManifestIcons = (manifest: ExtensionManifest): string[] => {
  const icons = [
    manifest.icon,
    ...manifest.panels.map(({ icon }) => icon),
    ...manifest.blockActions.map(({ icon }) => icon),
    ...manifest.elementViews.map(({ icon }) => icon)
  ];

  return [...new Set(icons.filter((icon) => icon !== undefined))];
};

/** The view CSS from the project's code, and the CSS of the manifest icons. */
const generateExtensionStyles = async (
  root: string,
  manifest: ExtensionManifest,
  sources: string,
  custom?: Record<string, string>
): Promise<ExtensionStyles> => {
  const icons = await loadIconCollections(root, custom);
  const classes = getManifestIcons(manifest);

  try {
    return {
      styles: await generateExtensionCSS({ name: manifest.name, icons, code: sources }),
      icons: classes.length
        ? await generateExtensionIconCSS({ name: manifest.name, icons, classes })
        : ""
    };
  } catch (error) {
    if (error instanceof ExtensionStyleError) throw new CLIError(error.message, exitCodes.usage);

    throw error;
  }
};

export { generateExtensionStyles };
