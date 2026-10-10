import {
  extensionRegistryIndexType,
  extensionVersionManifestType,
  type ExtensionArtifact,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions/registry";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CLIError, exitCodes } from "../../errors";
import type { createOutput } from "../../output";
import { type ArtifactName, artifactFiles, describeArtifact } from "../build";
import { exists } from "../project";
import { checkRegistry, type NewVersion } from "./check";
import { EXTENSIONS_DIRECTORY, INDEX_FILE } from "./repository";

interface RegistryBuildOptions {
  /** The registry repository. */
  repository: string;
  /** The published site: existing versions are read from it and new ones written to it. */
  published: string;
  /** The HTTPS URL that serves the published site. */
  siteURL: string;
  /** The repository commit of the build; defaults to `HEAD`. */
  commit?: string;
}
interface RegistryBuildResult {
  published: string[];
  errors: string[];
}

const VERSION_FILE = "version.json";
const runFile = promisify(execFile);

const getCommit = async (repository: string, commit?: string): Promise<string> => {
  const sha =
    commit ?? (await runFile("git", ["rev-parse", "HEAD"], { cwd: repository })).stdout.trim();

  if (!/^[a-f\d]{40}$/.test(sha)) throw new CLIError("Use a full commit SHA.", exitCodes.usage);

  return sha;
};
const getSiteURL = (siteURL: string): string => {
  const url = URL.canParse(siteURL) ? new URL(siteURL) : null;

  if (url?.protocol !== "https:") throw new CLIError("Use an HTTPS base URL.", exitCodes.usage);

  return url.href.replace(/\/$/, "");
};
/** Writes a new version's files, which are never overwritten, and returns its manifest. */
const writeVersion = async (
  published: string,
  siteURL: string,
  version: NewVersion,
  sourceCommit: string
): Promise<ExtensionVersionManifest> => {
  const { manifest } = version.entry.project;
  const relative = path.posix.join(EXTENSIONS_DIRECTORY, manifest.name, manifest.version);
  const directory = path.join(published, relative);
  const artifacts: Partial<Record<ArtifactName, ExtensionArtifact>> = {};

  if (await exists(directory)) {
    throw new CLIError(`${manifest.name}@${manifest.version} is already published.`);
  }

  await mkdir(directory, { recursive: true });

  for (const [name, file] of Object.entries(artifactFiles) as Array<[ArtifactName, string]>) {
    const content = version.contents[name];

    if (!content) continue;

    const { sha256, size } = describeArtifact(file, content);

    artifacts[name] = { url: `${siteURL}/${relative}/${file}`, sha256, size };
    await writeFile(path.join(directory, file), content);
  }

  const versionManifest = extensionVersionManifestType.parse({
    manifest,
    sourceCommit,
    artifacts,
    publishedAt: new Date().toISOString()
  });

  await writeFile(
    path.join(directory, VERSION_FILE),
    `${JSON.stringify(versionManifest, null, 2)}\n`
  );

  return versionManifest;
};

/** Writes new versions, then the index, so the index never names unpublished files. */
const buildRegistry = async (
  options: RegistryBuildOptions,
  output: ReturnType<typeof createOutput>
): Promise<RegistryBuildResult> => {
  const siteURL = getSiteURL(options.siteURL);
  const check = await checkRegistry(options.repository, options.published, output);
  const sourceCommit = await getCommit(options.repository, options.commit);
  const added = new Map<string, ExtensionVersionManifest>();

  if (check.errors.length) return { published: [], errors: check.errors };

  for (const version of check.newVersions) {
    const { name } = version.entry.project.manifest;

    added.set(name, await writeVersion(options.published, siteURL, version, sourceCommit));
  }

  const index = extensionRegistryIndexType.parse({
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    extensions: check.projects.map(({ project, keys, publisher }) => {
      const { name } = project.manifest;
      const versions = check.published.versions.get(name) ?? [];
      const version = added.get(name);

      return {
        name,
        publisher,
        keys: keys.keys,
        revokedKeys: keys.revokedKeys,
        versions: version ? [...versions, version] : versions
      };
    }),
    revocations: check.revocations
  });

  await writeFile(path.join(options.published, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);

  return {
    published: [...added.values()].map(({ manifest }) => `${manifest.name}@${manifest.version}`),
    errors: []
  };
};

export { buildRegistry };
export type { RegistryBuildOptions };
