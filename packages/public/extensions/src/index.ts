import { type extensionManifestType } from "@andesine/contracts/extensions";
// The configuration module alone, so the bundle carries no other contracts code.
import {
  type ExtensionConfiguration,
  toExtensionConfiguration
} from "@andesine/contracts/extensions/configuration";
import type * as z from "zod";

interface ExtensionDefinition extends Omit<ExtensionManifestInput, "configuration"> {
  /** A Zod object of flat fields, or the configuration schema it converts to. */
  configuration?: z.ZodObject | ExtensionConfiguration;
}
/** Options of `andesine extensions build`, exported from the config file as `build`. */
interface ExtensionBuildOptions {
  /** The module exporting the manifest's view entries (default: `src/frontend/index.tsx`). */
  frontend?: string;
  /** Custom icon sets: a set prefix and a directory of SVG files, e.g. `{ acme: "./icons" }`. */
  icons?: Record<string, string>;
}

type ExtensionManifestInput = z.input<typeof extensionManifestType>;

const isZodObject = (value: object): value is z.ZodObject => "_zod" in value;
/** Defines the `andesine.config.ts` manifest; a Zod configuration becomes JSON Schema. */
const defineExtension = (definition: ExtensionDefinition): ExtensionManifestInput => {
  const { configuration, ...manifest } = definition;

  if (!configuration) return manifest;

  return {
    ...manifest,
    configuration: isZodObject(configuration)
      ? toExtensionConfiguration(configuration)
      : configuration
  };
};
const defineBuild = (options: ExtensionBuildOptions): ExtensionBuildOptions => options;

export { defineExtension, defineBuild };
export type { ExtensionDefinition, ExtensionBuildOptions, ExtensionManifestInput };
