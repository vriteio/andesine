import { debounce } from "@solid-primitives/scheduled";
import { createEffect, on, onCleanup, onMount } from "solid-js";
import { useTree } from "#web/components/tree";
import { useWorkspace } from "#web/context/workspace";
import { preloadEntryStates } from "#web/context/workspace/entry-preload";
import { getWorkspaceDatabaseName, isIndexedDBAvailable } from "#web/context/workspace/indexeddb";

interface NavigatorWithConnection extends Navigator {
  connection?: { saveData?: boolean };
}

const PRELOAD_EXPAND_DELAY = 1_000;
const PRELOAD_REFRESH_INTERVAL = 10 * 60_000;
const MAX_PRELOAD_CANDIDATES = 200;

/** Caches top-level entries and the entries of expanded collections in the background. */
const useEntryPreload = () => {
  const [{ expanded }] = useTree();
  const { content, currentEntryID, currentSession, workspaceID } = useWorkspace();

  let running = false;
  let queued = false;
  let lastPreload = 0;

  const getCandidateIDs = () => {
    const expandedIDs = new Set(expanded());
    const isShown = (collectionID: string) => {
      const ancestors = content.collections.get({ collectionID })?.ancestors ?? [];

      return expandedIDs.has(collectionID) && ancestors.every((id) => expandedIDs.has(id));
    };

    return content
      .entriesCollection()
      .find()
      .fetch()
      .filter(({ id, collectionID }) => {
        return id !== currentEntryID() && (!collectionID || isShown(collectionID));
      })
      .slice(0, MAX_PRELOAD_CANDIDATES)
      .map(({ id }) => id);
  };
  const preload = () => {
    const userID = currentSession()?.user.id;
    const { connection } = navigator as NavigatorWithConnection;
    const unavailable =
      !userID ||
      !isIndexedDBAvailable() ||
      content.offline() ||
      content.loading() ||
      connection?.saveData;

    if (running) {
      queued = true;
      return;
    }

    if (unavailable) return;

    running = true;
    lastPreload = Date.now();
    void preloadEntryStates(getWorkspaceDatabaseName(workspaceID(), userID), getCandidateIDs())
      .catch((error) => console.error("Failed to preload entries", error))
      .finally(() => {
        running = false;

        if (queued) {
          queued = false;
          preloadWhenIdle();
        }
      });
  };
  const preloadWhenIdle = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(preload);
    else setTimeout(preload);
  };
  const preloadAfterExpand = debounce(preloadWhenIdle, PRELOAD_EXPAND_DELAY);
  // Back to the tab or online, after a while, entries may have changed elsewhere.
  const refresh = () => {
    const stale = Date.now() - lastPreload > PRELOAD_REFRESH_INTERVAL;

    if (document.visibilityState === "visible" && stale) preloadWhenIdle();
  };

  createEffect(
    on(content.loading, (loading) => {
      if (!loading) preloadWhenIdle();
    })
  );
  createEffect(on(expanded, preloadAfterExpand, { defer: true }));
  onMount(() => {
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    onCleanup(() => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    });
  });
};

export { useEntryPreload };
