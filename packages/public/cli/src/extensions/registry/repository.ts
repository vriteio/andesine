import {
  extensionRegistryEntryType,
  extensionRegistryIndexType,
  extensionRevocationType,
  extensionVersionManifestType,
  type ExtensionKeySet,
  type ExtensionRegistryEntry,
  type ExtensionRegistryIndex,
  type ExtensionRevocation,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions/registry";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CLIError, exitCodes } from "../../errors";
import { exists, loadExtensionProject, readExtensionKeys, type ExtensionProject } from "../project";

/** An extension project of the registry repository, at `extensions/<scope>/<name>`. */
interface RegistryProject {
  directoryName: string;
  project: ExtensionProject;
  keys: ExtensionKeySet;
  publisher: ExtensionRegistryEntry["publisher"];
}
/** The deployed registry site: its index and the versions it publishes per name. */
interface PublishedRegistry {
  index: ExtensionRegistryIndex | null;
  versions: Map<string, ExtensionVersionManifest[]>;
}

const EXTENSIONS_DIRECTORY = "extensions";
/** The registry entry data of a project that its manifest does not have. */
const PUBLISHER_FILE = "andesine.registry.json";
const REVOCATIONS_FILE = "registry/revocations.json";
const INDEX_FILE = "index.json";

const readJSON = async (file: string, label: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new CLIError(`${label} is not valid JSON.`, exitCodes.usage);
  }
};
const listDirectories = async (directory: string): Promise<string[]> => {
  if (!(await exists(directory))) return [];

  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map(({ name }) => name)
    .sort();
};

/** Loads every extension project with the registry rules for manifests (HTTPS URLs). */
const readRegistryProjects = async (repository: string): Promise<RegistryProject[]> => {
  const root = path.join(repository, EXTENSIONS_DIRECTORY);
  const projects: RegistryProject[] = [];

  for (const scope of await listDirectories(root)) {
    for (const name of await listDirectories(path.join(root, scope))) {
      const projectRoot = path.join(root, scope, name);
      const directoryName = `${scope}/${name}`;
      const publisherFile = path.join(projectRoot, PUBLISHER_FILE);

      if (!(await exists(publisherFile))) {
        throw new CLIError(`${directoryName} has no ${PUBLISHER_FILE}.`, exitCodes.usage);
      }

      const data = (await readJSON(publisherFile, `${directoryName}/${PUBLISHER_FILE}`)) as {
        publisher?: unknown;
      };
      const publisher = extensionRegistryEntryType.shape.publisher.safeParse(data.publisher);

      if (!publisher.success) {
        throw new CLIError(
          `${directoryName}/${PUBLISHER_FILE} has no valid publisher.`,
          exitCodes.usage
        );
      }

      projects.push({
        directoryName,
        project: await loadExtensionProject(projectRoot),
        keys: await readExtensionKeys(projectRoot),
        publisher: publisher.data
      });
    }
  }

  return projects;
};
const readRevocations = async (repository: string): Promise<ExtensionRevocation[]> => {
  const file = path.join(repository, REVOCATIONS_FILE);

  if (!(await exists(file))) return [];

  const revocations = extensionRevocationType
    .array()
    .safeParse(await readJSON(file, REVOCATIONS_FILE));

  if (!revocations.success) throw new CLIError(`${REVOCATIONS_FILE} is invalid.`, exitCodes.usage);

  return revocations.data;
};
/** The published index, if the site has one; every published version must be valid. */
const readPublishedRegistry = async (directory: string): Promise<PublishedRegistry> => {
  const file = path.join(directory, INDEX_FILE);
  const versions = new Map<string, ExtensionVersionManifest[]>();

  if (!(await exists(file))) return { index: null, versions };

  const index = extensionRegistryIndexType.safeParse(await readJSON(file, INDEX_FILE));

  if (!index.success) throw new CLIError(`The published ${INDEX_FILE} is invalid.`);

  for (const entry of index.data.extensions) {
    const parsed = entry.versions.map((version) => extensionVersionManifestType.safeParse(version));

    if (parsed.some((result) => !result.success)) {
      throw new CLIError(`A published version of ${entry.name} is invalid.`);
    }

    versions.set(
      entry.name,
      parsed.map((result) => result.data!)
    );
  }

  return { index: index.data, versions };
};

export {
  EXTENSIONS_DIRECTORY,
  INDEX_FILE,
  readPublishedRegistry,
  readRegistryProjects,
  readRevocations
};
export type { PublishedRegistry, RegistryProject };
