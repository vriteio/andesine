import { extensionNameType } from "@andesine/contracts/extensions/manifest";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CLIError, exitCodes } from "../errors";
import type { createOutput } from "../output";
import { copyTemplate } from "../pages/init";
import { generateExtensionKey, KEY_ENVIRONMENT_VARIABLE } from "./keys";

const TEMPLATE_NAME = "example/hello";
// Files of the template that name the extension.
const namedFiles = ["andesine.config.ts", "src/backend/server.ts"];

const rename = async (target: string, name: string): Promise<void> => {
  for (const file of namedFiles) {
    const source = await readFile(path.join(target, file), "utf8");

    await writeFile(path.join(target, file), source.replaceAll(`"${TEMPLATE_NAME}"`, `"${name}"`));
  }
};
/** `.env` for the local backend, with the private key; Git ignores it. */
const writeEnvironment = async (target: string, key: string): Promise<void> => {
  const example = await readFile(path.join(target, ".env.example"), "utf8");

  await writeFile(
    path.join(target, ".env"),
    example.replace(`${KEY_ENVIRONMENT_VARIABLE}=`, `${KEY_ENVIRONMENT_VARIABLE}='${key}'`),
    { mode: 0o600 }
  );
};

/** Creates an extension from the template, with a backend key pair. */
const initExtension = async (
  directory: string,
  options: { name?: string },
  output: ReturnType<typeof createOutput>
): Promise<void> => {
  if (options.name && !extensionNameType.safeParse(options.name).success) {
    throw new CLIError(
      "Use scope/name for the extension name, e.g. acme/publish.",
      exitCodes.usage
    );
  }

  const target = await copyTemplate("extension", directory, output);
  const key = await generateExtensionKey(target);

  if (options.name) await rename(target, options.name);

  await writeEnvironment(target, key.privateKey);
  await output.note("Next steps", {
    "Open the extension": `cd ${path.relative(process.cwd(), target) || "."}`,
    "Install": "npm install",
    "Build": "npm run build",
    "Start the backend": "npm run backend",
    "Backend key": `${key.kid} (private key in ${path.relative(target, key.file!)} and .env)`
  });
};

export { initExtension };
