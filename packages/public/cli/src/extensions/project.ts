import {
  type ExtensionBackendKey,
  type ExtensionManifest,
  developmentExtensionManifestType,
  extensionManifestType
} from "@andesine/contracts/extensions/manifest";
import { type ExtensionKeySet, extensionKeySetType } from "@andesine/contracts/extensions/registry";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import * as z from "zod";
import { CLIError, exitCodes } from "../errors";

/** The `build` export of the config file; see `defineBuild` in `@andesine/extensions`. */
interface ExtensionBuildOptions {
  frontend?: string;
  icons?: Record<string, string>;
}
interface ExtensionProject {
  root: string;
  manifest: ExtensionManifest;
  build: ExtensionBuildOptions;
}
/** `extensions dev`: development keys and, optionally, the local backend URL. */
interface DevelopmentOverrides {
  keys: ExtensionBackendKey[];
  backendURL?: string;
}
interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}

const CONFIG_FILE = "andesine.config.ts";
const KEYS_FILE = "andesine.keys.json";
/** Build output and private keys; the template ignores it in Git. */
const WORK_DIRECTORY = ".andesine";
const extensionBuildOptionsType = z
  .strictObject({
    frontend: z.string().min(1).optional(),
    icons: z.record(z.string().regex(/^[a-z\d]+(?:-[a-z\d]+)*$/), z.string().min(1)).optional()
  })
  .default({});

const exists = async (file: string): Promise<boolean> => {
  return access(file).then(
    () => true,
    () => false
  );
};
// Contracts can use another Zod version than the CLI, so issues are formatted here.
const formatError = (subject: string, issues: ValidationIssue[]): CLIError => {
  const lines = issues.map(({ path: at, message }) => {
    return `- ${at.length ? `${at.map(String).join(".")}: ` : ""}${message}`;
  });

  return new CLIError(`${subject} is invalid:\n${lines.join("\n")}`, exitCodes.usage);
};
/** Bundles the config into the work directory, so its imports resolve from the project. */
const importConfig = async (root: string): Promise<Record<string, unknown>> => {
  const file = path.join(root, WORK_DIRECTORY, "config.mjs");

  await build({
    cwd: root,
    input: path.join(root, CONFIG_FILE),
    platform: "node",
    external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
    logLevel: "silent",
    output: { file, format: "esm" }
  });

  return import(`${pathToFileURL(file).href}?t=${Date.now()}`);
};

/** Loads and validates the project; in development, the backend uses dev keys and may use HTTP. */
const loadExtensionProject = async (
  root: string,
  development?: DevelopmentOverrides
): Promise<ExtensionProject> => {
  if (!(await exists(path.join(root, CONFIG_FILE)))) {
    throw new CLIError(`No ${CONFIG_FILE} in ${root}.`, exitCodes.usage);
  }

  const config = await importConfig(root);
  const input = config.default as { backend?: object } | undefined;
  const developmentBackend = input?.backend && {
    ...input.backend,
    keys: development?.keys,
    ...(development?.backendURL && { url: development.backendURL })
  };
  const manifest = development
    ? developmentExtensionManifestType.safeParse({ ...input, backend: developmentBackend })
    : extensionManifestType.safeParse(input);
  const buildOptions = extensionBuildOptionsType.safeParse(config.build);

  if (!manifest.success) throw formatError("The manifest", manifest.error.issues);
  if (!buildOptions.success) throw formatError("The build options", buildOptions.error.issues);

  return { root, manifest: manifest.data, build: buildOptions.data };
};
// The public keys of the manifest, and the key IDs that the registry entry lists as revoked.
const readExtensionKeys = async (root: string): Promise<ExtensionKeySet> => {
  const file = path.join(root, KEYS_FILE);

  if (!(await exists(file))) return { keys: [], revokedKeys: [] };

  const keys = extensionKeySetType.safeParse(JSON.parse(await readFile(file, "utf8")));

  if (!keys.success) throw formatError(KEYS_FILE, keys.error.issues);

  return keys.data;
};
const writeExtensionKeys = async (root: string, keys: ExtensionKeySet): Promise<void> => {
  await writeFile(path.join(root, KEYS_FILE), `${JSON.stringify(keys, null, 2)}\n`);
};

export {
  KEYS_FILE,
  WORK_DIRECTORY,
  exists,
  loadExtensionProject,
  readExtensionKeys,
  writeExtensionKeys
};
export type { ExtensionBuildOptions, ExtensionProject, DevelopmentOverrides };
