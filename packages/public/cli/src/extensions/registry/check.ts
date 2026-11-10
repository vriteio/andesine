import {
  compareExtensionVersions,
  type ExtensionRevocation,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions/registry";
import type { ExtensionBackendKey } from "@andesine/contracts/extensions/manifest";
import { createHash } from "node:crypto";
import type { createOutput } from "../../output";
import { type ArtifactName, compileExtension } from "../build";
import {
  type PublishedRegistry,
  readPublishedRegistry,
  readRegistryProjects,
  readRevocations,
  type RegistryProject
} from "./repository";

/** A version that the next build publishes. */
interface NewVersion {
  entry: RegistryProject;
  contents: Record<ArtifactName, string>;
}
interface RegistryCheck {
  projects: RegistryProject[];
  published: PublishedRegistry;
  revocations: ExtensionRevocation[];
  newVersions: NewVersion[];
  /** Every problem found; the registry is valid when it is empty. */
  errors: string[];
}

const hash = (content: string): string => createHash("sha256").update(content).digest("hex");
const describeKey = (key: ExtensionBackendKey): string => {
  return JSON.stringify(key, Object.keys(key).sort());
};
// Keys belong to the extension, not to a version, so key changes need no new version.
const withoutKeys = (manifest: ExtensionVersionManifest["manifest"]): string => {
  return JSON.stringify({
    ...manifest,
    backend: manifest.backend && { ...manifest.backend, keys: [] }
  });
};
const findVersion = (versions: ExtensionVersionManifest[], version: string) => {
  return versions.find(({ manifest }) => manifest.version === version);
};

/** Keys belong to the extension: published keys never change, revoked keys stay revoked. */
const checkKeys = (entry: RegistryProject, published: PublishedRegistry): string[] => {
  const { name, backend } = entry.project.manifest;
  const previous = published.index?.extensions.find((item) => item.name === name);
  const current = new Map(entry.keys.keys.map((key) => [key.kid, describeKey(key)]));
  const errors: string[] = [];

  for (const key of backend?.keys ?? []) {
    if (current.get(key.kid) !== describeKey(key)) {
      errors.push(`${name}: manifest key ${key.kid} is not a current key of the extension`);
    }
  }

  for (const key of previous?.keys ?? []) {
    const isChanged = current.has(key.kid) && current.get(key.kid) !== describeKey(key);

    if (isChanged) errors.push(`${name}: published key ${key.kid} cannot change`);
  }

  for (const kid of previous?.revokedKeys ?? []) {
    if (!entry.keys.revokedKeys.includes(kid)) {
      errors.push(`${name}: revoked key ${kid} must stay revoked`);
    }
  }

  return errors;
};
/** A version is new and newer than every published one, or identical to the published one. */
const checkVersion = (
  entry: RegistryProject,
  versions: ExtensionVersionManifest[],
  contents: Record<ArtifactName, string>
): string[] => {
  const { manifest } = entry.project;
  const published = findVersion(versions, manifest.version);

  if (!published) {
    const newer = versions.find(({ manifest: item }) => {
      return compareExtensionVersions(item.version, manifest.version) > 0;
    });

    return newer
      ? [
          `${manifest.name}@${manifest.version}: versions publish in order; ${newer.manifest.version} is published`
        ]
      : [];
  }

  const errors: string[] = [];
  const styles = contents.styles ? hash(contents.styles) : undefined;

  if (withoutKeys(published.manifest) !== withoutKeys(manifest)) {
    errors.push(
      `${manifest.name}@${manifest.version}: published versions cannot change; use a new version`
    );
  }

  // CSS is the policy-relevant output, so a published version must rebuild to the same styles.
  if (styles !== published.artifacts.styles?.sha256) {
    errors.push(
      `${manifest.name}@${manifest.version}: the rebuilt styles differ from the published styles`
    );
  }

  return errors;
};
/** Revocations are permanent and name published (or new) versions and replacements. */
const checkRevocations = (
  revocations: ExtensionRevocation[],
  published: PublishedRegistry,
  available: Map<string, string[]>
): string[] => {
  const errors: string[] = [];
  const isRevoked = (name: string, version: string) => {
    return revocations.some((item) => item.name === name && item.version === version);
  };

  for (const previous of published.index?.revocations ?? []) {
    if (!isRevoked(previous.name, previous.version)) {
      errors.push(`${previous.name}@${previous.version}: revocations are permanent`);
    }
  }

  for (const revocation of revocations) {
    const versions = available.get(revocation.name) ?? [];
    const label = `${revocation.name}@${revocation.version}`;
    const isReplacementValid =
      !revocation.replacement ||
      (versions.includes(revocation.replacement) &&
        !isRevoked(revocation.name, revocation.replacement));

    if (!versions.includes(revocation.version)) errors.push(`${label}: no such version`);
    if (!isReplacementValid) errors.push(`${label}: the replacement is not available`);
  }

  return errors;
};

/** Builds each project and checks it against the published site, as instances do on ingestion. */
const checkRegistry = async (
  repository: string,
  publishedDirectory: string,
  output: ReturnType<typeof createOutput>
): Promise<RegistryCheck> => {
  const projects = await readRegistryProjects(repository);
  const published = await readPublishedRegistry(publishedDirectory);
  const revocations = await readRevocations(repository);
  const available = new Map<string, string[]>();
  const newVersions: NewVersion[] = [];
  const errors: string[] = [];

  for (const entry of projects) {
    const { name, version } = entry.project.manifest;
    const versions = published.versions.get(name) ?? [];

    if (entry.directoryName !== name) {
      errors.push(`${entry.directoryName}: the directory must match the name ${name}`);
    }

    await output.diagnostic(`Building ${name}@${version}`);

    const contents = await compileExtension(entry.project, output);
    const versionErrors = checkVersion(entry, versions, contents);

    errors.push(...checkKeys(entry, published), ...versionErrors);
    available.set(name, [...versions.map(({ manifest }) => manifest.version), version]);

    if (!findVersion(versions, version) && !versionErrors.length) {
      newVersions.push({ entry, contents });
    }
  }

  for (const name of published.versions.keys()) {
    if (!projects.some((entry) => entry.project.manifest.name === name)) {
      errors.push(`${name}: published extensions cannot be removed; revoke their versions`);
    }
  }

  errors.push(...checkRevocations(revocations, published, available));

  return { projects, published, revocations, newVersions, errors };
};

export { checkRegistry };
export type { NewVersion, RegistryCheck };
