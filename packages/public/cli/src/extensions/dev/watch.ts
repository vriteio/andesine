import { watch } from "node:fs";
import path from "node:path";
import { WORK_DIRECTORY } from "../project";

interface ChangeWatcher {
  /** Resolves after the next change, or at once when files changed since the last call. */
  next(): Promise<void>;
}

const DEBOUNCE = 200;
// Build output, dependencies, and the backend's environment do not change the extension.
const IGNORED_DIRECTORIES = ["node_modules", "dist", WORK_DIRECTORY, ".git"];

const isIgnored = (file: string): boolean => {
  const [directory] = file.split(path.sep);

  return IGNORED_DIRECTORIES.includes(directory!) || path.basename(file).startsWith(".env");
};

/** Watches the project recursively until the signal aborts. */
const watchChanges = (root: string, signal: AbortSignal): ChangeWatcher => {
  let changed = false;
  let notify: (() => void) | null = null;
  let timer: NodeJS.Timeout | undefined;

  watch(root, { recursive: true, signal }, (_event, file) => {
    if (!file || isIgnored(file)) return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      changed = true;
      notify?.();
    }, DEBOUNCE);
  }).on("error", () => {});

  return {
    next: () => {
      return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason);

        notify = () => {
          notify = null;
          changed = false;
          signal.removeEventListener("abort", abort);
          resolve();
        };

        if (signal.aborted) abort();
        else if (changed) notify();
        else signal.addEventListener("abort", abort, { once: true });
      });
    }
  };
};

export { watchChanges };
