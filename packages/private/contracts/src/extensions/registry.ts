import * as z from "zod";
import { uniqueItems } from "../webhooks/events";
import {
  extensionBackendKeyIDType,
  extensionBackendKeyType,
  extensionManifestType,
  extensionNameType,
  extensionURLType,
  extensionVersionType
} from "./manifest";

interface KeySetInput {
  keys: Array<{ kid: string }>;
  revokedKeys: string[];
}

type ExtensionKeySet = z.output<typeof extensionKeySetType>;
type ExtensionArtifact = z.output<typeof extensionArtifactType>;
type ExtensionVersionManifest = z.output<typeof extensionVersionManifestType>;
type ExtensionRevocation = z.output<typeof extensionRevocationType>;
type ExtensionRegistryEntry = z.output<typeof extensionRegistryEntryType>;
type ExtensionRegistryIndex = z.output<typeof extensionRegistryIndexType>;
type ExtensionDisabledReason = z.output<typeof extensionDisabledReasonType>;

// The backend and the registry tooling order versions with the same rules.
const splitVersion = (version: string): [number[], string[]] => {
  const separator = version.indexOf("-");
  const core = separator < 0 ? version : version.slice(0, separator);
  const prerelease = separator < 0 ? [] : version.slice(separator + 1).split(".");

  return [core.split(".").map(Number), prerelease];
};
const compareIdentifiers = (a: string, b: string): number => {
  const isNumericA = /^\d+$/.test(a);
  const isNumericB = /^\d+$/.test(b);

  if (isNumericA && isNumericB) return Number(a) - Number(b);

  if (isNumericA !== isNumericB) return isNumericA ? -1 : 1;

  return a < b ? -1 : Number(a > b);
};
/** Semantic version precedence: negative when `a` is older, positive when it is newer. */
const compareExtensionVersions = (a: string, b: string): number => {
  const [coreA, prereleaseA] = splitVersion(a);
  const [coreB, prereleaseB] = splitVersion(b);
  const coreDifference = coreA.map((part, index) => part - coreB[index]).find(Boolean);

  if (coreDifference) return coreDifference;

  if (!prereleaseA.length || !prereleaseB.length) {
    return prereleaseB.length - prereleaseA.length;
  }

  for (let index = 0; index < Math.min(prereleaseA.length, prereleaseB.length); index += 1) {
    const difference = compareIdentifiers(prereleaseA[index], prereleaseB[index]);

    if (difference) return difference;
  }

  return prereleaseA.length - prereleaseB.length;
};
const MAX_EXTENSION_ARTIFACT_SIZE = 5 * 1024 * 1024;
const MAX_REGISTRY_EXTENSIONS = 1000;
const MAX_REGISTRY_VERSIONS = 500;
const keySetShape = {
  keys: z.array(extensionBackendKeyType).max(10),
  revokedKeys: z.array(extensionBackendKeyIDType).max(100).default([])
};
const refineKeySet = ({ keys, revokedKeys }: KeySetInput, context: z.RefinementCtx): void => {
  if (!uniqueItems([...keys.map(({ kid }) => kid), ...revokedKeys])) {
    context.addIssue({
      code: "custom",
      path: ["keys"],
      message: "Key IDs must be unique and revoked keys cannot be listed as keys"
    });
  }
};
/** The keys of a registry entry; extension projects keep them in `andesine.keys.json`. */
const extensionKeySetType = z.object(keySetShape).superRefine(refineKeySet);
const extensionArtifactType = z.strictObject({
  url: extensionURLType,
  sha256: z.string().regex(/^[a-f\d]{64}$/, "Use a lowercase hex SHA-256 digest"),
  size: z.int().positive().max(MAX_EXTENSION_ARTIFACT_SIZE)
});
/** An immutable registry version: the reviewed manifest and its build output. */
const extensionVersionManifestType = z.strictObject({
  manifest: extensionManifestType,
  sourceCommit: z.string().regex(/^[a-f\d]{40}$/, "Use a full commit SHA"),
  artifacts: z.strictObject({
    frontend: extensionArtifactType,
    /** CSS for the extension views. */
    styles: extensionArtifactType.optional(),
    /** CSS for the manifest icons, which the host shows outside the extension views. */
    icons: extensionArtifactType.optional()
  }),
  publishedAt: z.iso.datetime()
});
const extensionRevocationType = z.strictObject({
  name: extensionNameType,
  version: extensionVersionType,
  reason: z.string().min(1).max(500),
  replacement: extensionVersionType.optional(),
  recordedAt: z.iso.datetime()
});
// Lenient objects and per-version validation keep older instances working with newer registries.
const extensionRegistryEntryType = z
  .object({
    name: extensionNameType,
    publisher: z.object({ name: z.string().min(1).max(100), url: extensionURLType.optional() }),
    ...keySetShape,
    versions: z.array(z.unknown()).max(MAX_REGISTRY_VERSIONS)
  })
  .superRefine(refineKeySet);
const extensionRegistryIndexType = z
  .object({
    formatVersion: z.literal(1),
    generatedAt: z.iso.datetime(),
    extensions: z.array(extensionRegistryEntryType).max(MAX_REGISTRY_EXTENSIONS),
    revocations: z.array(extensionRevocationType).default([])
  })
  .refine(
    ({ extensions }) => uniqueItems(extensions.map(({ name }) => name)),
    "Extension names must be unique"
  );
const extensionDisabledReasonType = z.enum([
  "manual",
  "approval_required",
  "configuration_required",
  "revoked"
]);

export {
  MAX_EXTENSION_ARTIFACT_SIZE,
  compareExtensionVersions,
  extensionKeySetType,
  extensionArtifactType,
  extensionVersionManifestType,
  extensionRevocationType,
  extensionRegistryEntryType,
  extensionRegistryIndexType,
  extensionDisabledReasonType
};
export type {
  ExtensionKeySet,
  ExtensionArtifact,
  ExtensionVersionManifest,
  ExtensionRevocation,
  ExtensionRegistryEntry,
  ExtensionRegistryIndex,
  ExtensionDisabledReason
};
