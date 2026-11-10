import {
  type ExtensionBackendKey,
  extensionBackendKeyIDType,
  extensionBackendKeyType
} from "@andesine/contracts/extensions/manifest";
import { extensionRegistryIndexType } from "@andesine/contracts/extensions/registry";
import { execFile } from "node:child_process";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type webcrypto
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CLIError, exitCodes } from "../errors";
import {
  KEYS_FILE,
  WORK_DIRECTORY,
  loadExtensionProject,
  readExtensionKeys,
  writeExtensionKeys
} from "./project";

interface GeneratedKey {
  kid: string;
  /** The private JWK, for a secret manager or the local `.env`. */
  privateKey: string;
  /** The private JWK file, readable only by its owner; none when printed. */
  file?: string;
  /** False when Git does not ignore the private key file. */
  ignored: boolean;
}
interface PrivateKey extends webcrypto.JsonWebKey {
  kid?: string;
}
interface CheckedKey {
  kid: string;
  name: string;
  registry?: string;
}

const MAX_KEYS = 3;
const KEY_ENVIRONMENT_VARIABLE = "ANDESINE_EXTENSION_KEY";
const runFile = promisify(execFile);

const createKeyID = (taken: string[]): string => {
  const base = `key-${new Date().toISOString().slice(0, 10)}`;

  let kid = base;

  for (let index = 2; taken.includes(kid); index += 1) kid = `${base}-${index}`;

  return kid;
};
const isIgnored = async (root: string, file: string): Promise<boolean> => {
  try {
    await runFile("git", ["check-ignore", "--quiet", file], { cwd: root });

    return true;
  } catch (error) {
    // Exit code 1 means not ignored; others mean no repository or no Git.
    return (error as { code?: number }).code !== 1;
  }
};
// Errors never include the key, which can come from an environment variable.
const parsePrivateKey = (source: string): PrivateKey => {
  try {
    const key = JSON.parse(source);

    if (key.d && key.kid) return key;
  } catch {}

  throw new CLIError("The private key must be a private JSON Web Key with a kid.", exitCodes.usage);
};
const toPublicKey = (privateKey: PrivateKey): ExtensionBackendKey => {
  const jwk = createPublicKey(createPrivateKey({ key: privateKey, format: "jwk" })).export({
    format: "jwk"
  });
  const alg = jwk.crv === "Ed25519" ? "EdDSA" : "ES256";
  const key = extensionBackendKeyType.safeParse({ kid: privateKey.kid, alg, ...jwk });

  if (!key.success) throw new CLIError("Use an Ed25519 or P-256 private key.", exitCodes.usage);

  return key.data;
};
const describeKey = (key: ExtensionBackendKey): string => {
  return [key.kid, key.alg, key.x, "y" in key ? key.y : ""].join(" ");
};
const isSameKey = (left: ExtensionBackendKey, right: ExtensionBackendKey): boolean => {
  return describeKey(left) === describeKey(right);
};

/** Generates an Ed25519 key: the public JWK goes to the keys file, the private one stays local. */
const generateExtensionKey = async (
  root: string,
  options: { kid?: string; print?: boolean } = {}
): Promise<GeneratedKey> => {
  const keys = await readExtensionKeys(root);
  const taken = [...keys.keys.map(({ kid }) => kid), ...keys.revokedKeys];
  const kid = options.kid ?? createKeyID(taken);
  const directory = path.join(root, WORK_DIRECTORY, "keys");
  const file = path.join(directory, `${kid}.json`);
  const isNewKeyID = extensionBackendKeyIDType.safeParse(kid).success && !taken.includes(kid);

  if (keys.keys.length >= MAX_KEYS) {
    throw new CLIError(`${KEYS_FILE} has ${MAX_KEYS} keys. Revoke one first.`, exitCodes.usage);
  }

  if (!isNewKeyID) {
    throw new CLIError(`Use a new key ID of letters, digits, ".", "_" or "-".`, exitCodes.usage);
  }

  const { privateKey } = generateKeyPairSync("ed25519");
  const privateJWK = { kid, alg: "EdDSA", ...privateKey.export({ format: "jwk" }) };
  const serialized = JSON.stringify(privateJWK);

  if (!options.print) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(file, `${serialized}\n`, { mode: 0o600, flag: "wx" });
  }

  await writeExtensionKeys(root, { ...keys, keys: [...keys.keys, toPublicKey(privateJWK)] });

  if (options.print) return { kid, privateKey: serialized, ignored: true };

  return { kid, privateKey: serialized, file, ignored: await isIgnored(root, file) };
};
/** Checks that a private key matches a current manifest key and, optionally, a registry key. */
const checkExtensionKey = async (
  root: string,
  options: { key?: string; registry?: string } = {}
): Promise<CheckedKey> => {
  const source = options.key
    ? await readFile(path.resolve(options.key), "utf8")
    : process.env[KEY_ENVIRONMENT_VARIABLE];

  if (!source) {
    throw new CLIError(`Set ${KEY_ENVIRONMENT_VARIABLE} or use --key <file>.`, exitCodes.usage);
  }

  const publicKey = toPublicKey(parsePrivateKey(source));
  const { manifest } = await loadExtensionProject(root);
  const { revokedKeys } = await readExtensionKeys(root);
  const manifestKey = manifest.backend?.keys.find(({ kid }) => kid === publicKey.kid);

  if (revokedKeys.includes(publicKey.kid)) {
    throw new CLIError(`Key ${publicKey.kid} is revoked.`, exitCodes.failure);
  }

  if (!manifestKey || !isSameKey(manifestKey, publicKey)) {
    throw new CLIError(`Key ${publicKey.kid} is not a key of the manifest.`, exitCodes.failure);
  }

  if (!options.registry) return { kid: publicKey.kid, name: manifest.name };

  const response = await fetch(options.registry);

  if (!response.ok) {
    throw new CLIError(`The registry returned HTTP ${response.status}.`, exitCodes.failure);
  }

  const index = extensionRegistryIndexType.safeParse(await response.json());

  if (!index.success) throw new CLIError("The registry index is invalid.", exitCodes.failure);

  const entry = index.data.extensions.find(({ name }) => name === manifest.name);
  const registryKey = entry?.keys.find(({ kid }) => kid === publicKey.kid);
  const isTrusted = Boolean(registryKey && isSameKey(registryKey, publicKey));

  if (!entry) throw new CLIError(`The registry has no ${manifest.name}.`, exitCodes.failure);

  // Registry entries reject revoked IDs among their keys, so a listed key is current.
  if (!isTrusted) {
    throw new CLIError(`The registry does not trust key ${publicKey.kid}.`, exitCodes.failure);
  }

  return { kid: publicKey.kid, name: manifest.name, registry: options.registry };
};
/** Removes a public key from the manifest keys and records its ID as revoked. */
const revokeExtensionKey = async (root: string, kid: string): Promise<void> => {
  const keys = await readExtensionKeys(root);

  if (!keys.keys.some((key) => key.kid === kid)) {
    throw new CLIError(`${KEYS_FILE} has no key ${kid}.`, exitCodes.usage);
  }

  await writeExtensionKeys(root, {
    keys: keys.keys.filter((key) => key.kid !== kid),
    revokedKeys: [...keys.revokedKeys, kid]
  });
};

export { KEY_ENVIRONMENT_VARIABLE, generateExtensionKey, checkExtensionKey, revokeExtensionKey };
