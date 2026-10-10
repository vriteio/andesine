import type { ExtensionBackendKey } from "@andesine/contracts/extensions/manifest";
import { generateKeyPairSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { KEY_ENVIRONMENT_VARIABLE } from "../keys";
import { exists, WORK_DIRECTORY } from "../project";

interface DevelopmentKey {
  /** The private JWK, for the local backend. */
  privateKey: string;
  publicKey: ExtensionBackendKey;
}

const KEY_ID = "development";
const INSTANCES_VARIABLE = "ANDESINE_INSTANCES";

/** The project's development key pair, created once; the instance gets only the public key. */
const getDevelopmentKey = async (root: string): Promise<DevelopmentKey> => {
  const directory = path.join(root, WORK_DIRECTORY, "keys");
  const file = path.join(directory, `${KEY_ID}.json`);

  if (!(await exists(file))) {
    const { privateKey } = generateKeyPairSync("ed25519");
    const jwk = { kid: KEY_ID, alg: "EdDSA", ...privateKey.export({ format: "jwk" }) };

    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(file, `${JSON.stringify(jwk)}\n`, { mode: 0o600 });
  }

  const privateKey = (await readFile(file, "utf8")).trim();
  const { x } = JSON.parse(privateKey) as { x: string };

  return { privateKey, publicKey: { kid: KEY_ID, kty: "OKP", alg: "EdDSA", crv: "Ed25519", x } };
};
/** Sets a variable of an environment file, replacing its line or adding one. */
const setVariable = (source: string, name: string, value: string): string => {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");

  if (pattern.test(source)) return source.replace(pattern, () => line);

  return `${source}${source && !source.endsWith("\n") ? "\n" : ""}${line}\n`;
};
/** Sets the development key and trusted instance in the backend's environment file. */
const writeDevelopmentEnvironment = async (
  root: string,
  file: string,
  key: DevelopmentKey,
  baseURL: string
): Promise<void> => {
  const target = path.resolve(root, file);
  const example = path.join(root, ".env.example");
  const sourceFile = (await exists(target)) ? target : example;
  const source = (await exists(sourceFile)) ? await readFile(sourceFile, "utf8") : "";
  const instances = new RegExp(`^${INSTANCES_VARIABLE}=(.*)$`, "m")
    .exec(source)?.[1]
    ?.split(",")
    .filter(Boolean);
  const trusted = [...new Set([...(instances ?? []), baseURL])].join(",");
  const updated = setVariable(
    setVariable(source, KEY_ENVIRONMENT_VARIABLE, `'${key.privateKey}'`),
    INSTANCES_VARIABLE,
    trusted
  );

  await writeFile(target, updated, { mode: 0o600 });
};

export { getDevelopmentKey, writeDevelopmentEnvironment };
export type { DevelopmentKey };
