import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import { CLIError, exitCodes } from "../errors";
import { GENERATED_TYPES_MARKER } from "./generate";

/** Read without creating files, directories, or locks. Reject links and non-regular files. */
const readTypesFile = async (file: string): Promise<string | undefined> => {
  try {
    const info = await lstat(file);

    if (!info.isFile() || info.isSymbolicLink()) {
      throw new CLIError("The types output must be a regular file, not a link.", exitCodes.usage);
    }

    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;

    throw error;
  }
};

/** Replace only a reviewed file, atomically, and leave identical output untouched. */
const writeTypesFile = async (
  file: string,
  source: string,
  expected: string | undefined,
  signal: AbortSignal,
  force = false
): Promise<boolean> => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const generated = expected?.split(/\r?\n/, 1)[0] === GENERATED_TYPES_MARKER;

  let compromised = false;

  signal.throwIfAborted();

  if (expected !== undefined && !generated && !force) {
    throw new CLIError(
      `Refusing to replace ${file}: it is not an Andesine generated file. Choose another --output or use --force to replace it.`,
      exitCodes.usage
    );
  }

  if (expected === source && (await readTypesFile(file)) === source) return false;

  await mkdir(path.dirname(file), { recursive: true });

  const release = await lockfile.lock(file, {
    realpath: false,
    onCompromised: () => {
      compromised = true;
    }
  });
  const assertUnchanged = async () => {
    signal.throwIfAborted();

    if (compromised) throw new CLIError("The types file lock was lost. Run generation again.");

    if ((await readTypesFile(file)) !== expected) {
      throw new CLIError("The types file changed during generation. Run generation again.");
    }
  };

  try {
    await assertUnchanged();
    if (expected === source) return false;

    const info = expected === undefined ? undefined : await lstat(file);

    await writeFile(temporary, source, { flag: "wx", mode: info?.mode ?? 0o644 });
    await assertUnchanged();

    if (expected === undefined) await link(temporary, file);
    else await rename(temporary, file);

    return true;
  } finally {
    try {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    } finally {
      await release().catch((error: unknown) => {
        if (!compromised) throw error;
      });
    }
  }
};

export { readTypesFile, writeTypesFile };
