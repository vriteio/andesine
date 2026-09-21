import { CLIError, exitCodes } from "../errors";
import type { ProjectConfig } from "../config/schema";
import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";

const readProjectFile = async (file: string): Promise<string | undefined> => {
  try {
    const info = await lstat(file);

    if (!info.isFile() || info.isSymbolicLink()) {
      throw new CLIError(
        "The project configuration must be a regular file, not a link.",
        exitCodes.usage
      );
    }

    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;

    throw error;
  }
};

/** Recheck the reviewed file under a lock, then replace it with complete JSON. */
const writeProjectConfig = async (
  file: string,
  config: ProjectConfig,
  expected: string | undefined,
  signal: AbortSignal
): Promise<void> => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let compromised = false;

  signal.throwIfAborted();
  await mkdir(path.dirname(file), { recursive: true });

  const release = await lockfile.lock(file, {
    realpath: false,
    onCompromised: () => {
      compromised = true;
    }
  });

  try {
    if ((await readProjectFile(file)) !== expected) {
      throw new CLIError("The project configuration changed during setup. Run init again.");
    }

    const info = expected === undefined ? undefined : await lstat(file);

    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, {
      flag: "wx",
      mode: info?.mode ?? 0o644
    });
    signal.throwIfAborted();

    if (compromised) throw new CLIError("The configuration lock was lost. Run init again.");

    if (expected === undefined) {
      await link(temporary, file);
    } else {
      if ((await readProjectFile(file)) !== expected) {
        throw new CLIError("The project configuration changed during setup. Run init again.");
      }

      await rename(temporary, file);
    }
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

export { readProjectFile, writeProjectConfig };
