import { type ExtensionDetails } from "@andesine/contracts/extensions";
import { useParams } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import { config } from "#web/lib/api";
import { extensionQuery } from "#web/lib/data";

/**
 * The extension of the current settings route, for names and icons in menus and breadcrumbs. It
 * loads in a browser effect, not a resource, so navigating to extension pages doesn't wait for it;
 * the server and hydration render without it. It shares the cache with the extension pages.
 */
const useRouteExtension = () => {
  const params = useParams<{ workspaceID?: string; extensionID?: string }>();
  const [extension, setExtension] = createSignal<ExtensionDetails | null>(null);

  createEffect(() => {
    const { workspaceID, extensionID } = params;

    let current = true;

    onCleanup(() => (current = false));

    if (untrack(extension)?.id !== extensionID) setExtension(null);
    if (!config.PUBLIC_EXTENSIONS_ENABLED || !workspaceID || !extensionID) return;

    // Untracked: a query called during navigation updates its version, which would re-run this.
    untrack(() => extensionQuery({ workspaceID, extensionID })).then(
      (loaded) => current && setExtension(loaded),
      () => current && setExtension(null)
    );
  });

  return extension;
};

export { useRouteExtension };
