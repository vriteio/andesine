import { type ExtensionRuntime } from "@andesine/contracts/extensions";
import { useWorkspace } from "#web/context/workspace";
import { extensionRuntimeQuery } from "#web/lib/data";
import { loadExtensionArtifact, startExtension, stopExtension } from "#web/lib/extensions";
import { createAsync, revalidate } from "@solidjs/router";
import { type Component, createEffect, onCleanup } from "solid-js";

// A new version, generation, or grant restarts the frontend; configuration updates do not.
const getRuntimeKey = (extension: ExtensionRuntime): string => {
  return JSON.stringify([extension.version, extension.generation, extension.grant]);
};

/** Runs active extension frontends from verified registry artifacts. */
const ExtensionLoader: Component = () => {
  const { workspaceID, subscribeToUpdates } = useWorkspace();
  const runtime = createAsync(async () => {
    const id = workspaceID();

    return id ? extensionRuntimeQuery(id) : [];
  });
  // Runtime key by extension ID.
  const started = new Map<string, string>();
  // Each extension's latest load; loads of one extension run in order, so starts never overlap.
  const loads = new Map<string, Promise<void>>();
  const isCurrent = (extension: ExtensionRuntime, key: string): boolean => {
    return started.get(extension.id) === key;
  };
  const load = async (extension: ExtensionRuntime, key: string): Promise<void> => {
    const { frontend, styles, icons } = extension.artifacts;

    if (!isCurrent(extension, key)) return;

    const [code, styleSheet, iconStyles] = await Promise.all([
      loadExtensionArtifact(frontend),
      styles ? loadExtensionArtifact(styles) : undefined,
      icons ? loadExtensionArtifact(icons) : undefined
    ]);

    if (!isCurrent(extension, key)) return;

    await startExtension({
      extensionID: extension.id,
      name: extension.name,
      code,
      styles: styleSheet,
      iconStyles,
      connectSources: extension.grant.requests,
      backend: extension.grant.backendURL ?? undefined,
      grant: extension.grant.permissions,
      elementViews: extension.elementViews,
      blockActions: extension.blockActions,
      panels: extension.panels
    });

    // Removed while it was starting.
    if (!started.has(extension.id)) stopExtension(extension.id);
  };

  createEffect(() => {
    const extensions = runtime();

    if (!extensions) return;

    for (const id of [...started.keys()]) {
      if (extensions.some((extension) => extension.id === id)) continue;

      started.delete(id);
      stopExtension(id);
    }

    for (const extension of extensions) {
      const key = getRuntimeKey(extension);

      if (isCurrent(extension, key)) continue;

      const previous = loads.get(extension.id) ?? Promise.resolve();
      const next = previous
        .then(() => load(extension, key))
        .catch((error: unknown) => {
          console.warn(`Extension ${extension.name} could not start`, error);

          // The next runtime refresh tries again.
          if (isCurrent(extension, key)) started.delete(extension.id);
        })
        .finally(() => {
          if (loads.get(extension.id) === next) loads.delete(extension.id);
        });

      started.set(extension.id, key);
      loads.set(extension.id, next);
    }
  });
  onCleanup(
    subscribeToUpdates((event) => {
      if (event.action.startsWith("extension:")) void revalidate(extensionRuntimeQuery.key);
    })
  );
  onCleanup(() => {
    for (const id of started.keys()) stopExtension(id);

    started.clear();
  });

  return null;
};

export { ExtensionLoader };
