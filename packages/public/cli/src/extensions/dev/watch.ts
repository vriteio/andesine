import { readdirSync, statSync, watch } from "node:fs";
import path from "node:path";

interface ChangeWatcher {
  /** Resolves after the next change, or at once when files changed since the last call. */
  next(): Promise<void>;
}

const DEBOUNCE = 200;
// A busy system can refuse file watches for a moment, e.g. macOS file events with many watchers.
const RETRY_DELAYS = [500, 2000];
const POLL_INTERVAL = 1000;
// Build output, dependencies, dot folders (Git, the work directory, tools' state), and the
// backend's environment do not change the extension.
const IGNORED_DIRECTORIES = ["node_modules", "dist"];
// One recursive watch costs one system watch here, even over ignored folders.
const HAS_NATIVE_RECURSIVE_WATCH = ["darwin", "win32"].includes(process.platform);

const isIgnored = (file: string): boolean => {
  const [directory] = file.split(path.sep);

  return (
    IGNORED_DIRECTORIES.includes(directory!) ||
    directory!.startsWith(".") ||
    path.basename(file).startsWith(".env")
  );
};
/**
 * The folders to watch, relative to the root: the root itself where recursive watches are native,
 * else the root alone and its folders that aren't ignored, as recursive watches there can open a
 * handle per folder, e.g. in `node_modules`.
 */
const getWatchedFolders = (root: string): Array<{ folder: string; recursive: boolean }> => {
  if (HAS_NATIVE_RECURSIVE_WATCH) return [{ folder: "", recursive: true }];

  return [
    { folder: "", recursive: false },
    ...readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !isIgnored(entry.name))
      .map((entry) => ({ folder: entry.name, recursive: true }))
  ];
};
/** The files that aren't ignored, by path, with their change times and sizes. */
const getSnapshot = (root: string, folder = "", files = new Map<string, string>()) => {
  try {
    readdirSync(path.join(root, folder), { withFileTypes: true }).forEach((entry) => {
      const file = path.join(folder, entry.name);

      if (isIgnored(file)) return;

      if (entry.isDirectory()) getSnapshot(root, file, files);
      else if (entry.isFile()) {
        const stats = statSync(path.join(root, file));

        files.set(file, `${stats.mtimeMs}:${stats.size}`);
      }
    });
  } catch {
    /* Files can change while they're read; the next snapshot sees them. */
  }

  return files;
};

/**
 * Watches the project until the signal aborts. If the system refuses the watches, it retries,
 * then checks the files for changes every second, and calls `onPolling` with the error.
 */
const watchChanges = (
  root: string,
  signal: AbortSignal,
  onPolling?: (error: Error) => void
): ChangeWatcher => {
  let changed = false;
  let notify: (() => void) | null = null;
  let timer: NodeJS.Timeout | undefined;

  const onChange = (file: string) => {
    if (isIgnored(file)) return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      changed = true;
      notify?.();
    }, DEBOUNCE);
  };
  const poll = (error: Error) => {
    let previous = getSnapshot(root);

    const interval = setInterval(() => {
      const next = getSnapshot(root);
      const changedFile = [...next].find(([file, version]) => previous.get(file) !== version)?.[0];
      const removedFile = [...previous.keys()].find((file) => !next.has(file));

      previous = next;

      if (changedFile ?? removedFile) onChange(changedFile ?? removedFile!);
    }, POLL_INTERVAL);

    signal.addEventListener("abort", () => clearInterval(interval), { once: true });
    onPolling?.(error);
  };
  const start = (attempt = 0) => {
    if (signal.aborted) return;

    const controller = new AbortController();
    const watchSignal = AbortSignal.any([signal, controller.signal]);

    let failed = false;

    const onError = (error: Error) => {
      if (failed || signal.aborted) return;

      failed = true;
      controller.abort();

      if (attempt < RETRY_DELAYS.length)
        setTimeout(() => start(attempt + 1), RETRY_DELAYS[attempt]);
      else poll(error);
    };

    try {
      getWatchedFolders(root).forEach(({ folder, recursive }) => {
        watch(path.join(root, folder), { recursive, signal: watchSignal }, (_event, file) => {
          if (file) onChange(path.join(folder, file));
        }).on("error", onError);
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  start();

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
