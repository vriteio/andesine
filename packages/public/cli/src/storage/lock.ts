import { CLIError } from "../errors";
import { ensurePrivateDirectory, stateDirectory } from "./files";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import path from "node:path";
import lockfile from "proper-lockfile";

/** Serialize metadata updates and token rotation across CLI processes. */
const withStateLock = async <Value>(
  name: string,
  signal: AbortSignal,
  run: (assertOwned: () => void) => Promise<Value>
): Promise<Value> => {
  const directory = path.join(stateDirectory(), "locks");
  const target = path.join(directory, createHash("sha256").update(name).digest("hex"));
  const deadline = Date.now() + 150_000;
  let compromised = false;
  let release: (() => Promise<void>) | undefined;

  await ensurePrivateDirectory(directory);

  while (!release) {
    signal.throwIfAborted();

    try {
      release = await lockfile.lock(target, {
        realpath: false,
        stale: 120_000,
        update: 10_000,
        onCompromised: () => {
          compromised = true;
        }
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ELOCKED") {
        throw new CLIError("Cannot lock CLI storage.");
      }

      if (Date.now() >= deadline) {
        throw new CLIError("Another CLI process is using these credentials. Try again later.");
      }

      await setTimeout(100, undefined, { signal });
    }
  }

  const assertOwned = () => {
    signal.throwIfAborted();
    if (compromised) {
      throw new CLIError("The credential lock was lost. Run auth status before retrying.");
    }
  };

  try {
    assertOwned();
    return await run(assertOwned);
  } finally {
    await release().catch(() => {
      /* A compromised lock belongs to another process. */
    });
  }
};

export { withStateLock };
