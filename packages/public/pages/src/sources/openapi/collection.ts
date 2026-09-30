import { defineCollection } from "astro/content/config";
import type { OpenAPISourceConfig } from "../../config";
import { normalizeSpec } from "./normalize";
import { readSpec } from "./read";
import { recordID, type StoredSpec } from "./stored";

/**
 * Reads and normalizes a spec at build time. A local spec loads again when it, or a local file
 * that it references, changes.
 */
const createOpenAPICollection = (source: OpenAPISourceConfig) => {
  // Syncs call the loader again; the watcher calls the latest load, and gets one listener.
  const watchers = new WeakSet<object>();

  let reload: (() => Promise<void>) | undefined;
  let files: string[] = [];
  // Reloads run in order, so a slower, older reload cannot replace a newer model.
  let reloads = Promise.resolve();

  return defineCollection({
    loader: {
      name: `openapi-${source.id}`,
      load: async ({ store, config, logger, watcher }) => {
        const load = async (): Promise<void> => {
          const spec = await readSpec(source, config.root);
          const specURL = source.spec.startsWith("https://") ? source.spec : undefined;
          const { model, ignored } = normalizeSpec(spec.document, `Source "${source.id}"`, specURL);
          const stored: StoredSpec = { model };

          // References can change, so the new files are watched too.
          files = spec.files;
          watcher?.add(files);

          store.clear();
          store.set({ id: recordID, data: stored as never });
          logger.info(`Source "${source.id}": loaded ${model.operations.length} operations.`);

          if (ignored.length) {
            logger.warn(`Source "${source.id}": ${ignored.join(" and ")} are not shown.`);
          }
        };

        reload = load;
        await load();

        if (!watcher || watchers.has(watcher)) return;

        const onChange = (changed: string): void => {
          if (!files.includes(changed)) return;

          reloads = reloads
            .then(() => reload?.())
            .catch((error: Error) => logger.error(error.message));
        };

        watchers.add(watcher);
        // A referenced file that did not exist yet is added, not changed.
        watcher.on("add", onChange);
        watcher.on("change", onChange);
      }
    }
  });
};

export { createOpenAPICollection };
