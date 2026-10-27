import { type ExtensionPage } from "@andesine/contracts/extensions";
import { client } from "#web/lib/api";
import { createSignal } from "solid-js";
import { getExtensionPagePath } from "./pages";

interface PageContextIDs {
  collectionID?: string;
  entryID?: string;
  /** The nearest collection with publishing on, the page's or one around it. */
  publishingCollectionID?: string;
}

type PageContextResolver = (ids: PageContextIDs) => PageContextIDs;

const PLACEHOLDER_PATTERN = /\{(collectionID|entryID|publishingCollectionID)\}/g;
const RETRY_DELAY = 5000;

// The keys of each extension's storage under the prefixes that its pages' conditions use.
const [storageKeys, setStorageKeys] = createSignal(new Map<string, Set<string>>());
const loading = new Map<string, Promise<void>>();
const extensionPages = new Map<string, ExtensionPage[]>();

let resolveContext: PageContextResolver = (ids) => ids;

const getCacheKey = (extensionID: string, prefix: string) => `${extensionID}\n${prefix}`;
/** A key template's fixed text before its first placeholder, which the keys are listed by. */
const getKeyPrefix = (template: string): string => template.split("{")[0]!;
/** The storage key for the context, or null when the context lacks one of its IDs. */
const fillKey = (template: string, ids: PageContextIDs): string | null => {
  let isComplete = true;

  const key = template.replace(PLACEHOLDER_PATTERN, (_, name: keyof PageContextIDs) => {
    isComplete &&= Boolean(ids[name]);

    return ids[name] ?? "";
  });

  return isComplete ? key : null;
};
const listStorageKeys = async (extensionID: string, prefix: string): Promise<Set<string>> => {
  const keys = new Set<string>();

  let after: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await client.extensions.listStorageEntries({ extensionID, prefix, after });

    page.data.forEach(({ key }) => keys.add(key));
    after = page.data.at(-1)?.key;
    hasMore = page.hasMore && Boolean(after);
  }

  return keys;
};
/**
 * Loads the storage keys that the extension's page conditions use; the cached keys stay in use
 * meanwhile. Called when the extension starts, when a menu or a page opens, and before `openPage`,
 * as its backend can change its storage.
 */
const refreshPageAvailability = (extensionID: string): Promise<void> => {
  const pages = extensionPages.get(extensionID) ?? [];
  const prefixes = new Set(
    pages.flatMap(({ when }) => (when?.storage ? [getKeyPrefix(when.storage.key)] : []))
  );
  const loads = [...prefixes].map((prefix) => {
    const cacheKey = getCacheKey(extensionID, prefix);
    const pending =
      loading.get(cacheKey) ??
      listStorageKeys(extensionID, prefix)
        .then((keys) => {
          setStorageKeys((current) => {
            const cached = current.get(cacheKey);
            const isSame = cached?.size === keys.size && [...keys].every((key) => cached.has(key));

            return isSame ? current : new Map(current).set(cacheKey, keys);
          });
        })
        .catch(() => {
          // Pages wait for the keys, so a failed load tries again while the extension runs.
          setTimeout(() => {
            if (extensionPages.has(extensionID)) void refreshPageAvailability(extensionID);
          }, RETRY_DELAY);
        })
        .finally(() => loading.delete(cacheKey));

    loading.set(cacheKey, pending);

    return pending;
  });

  return Promise.all(loads).then(() => undefined);
};
/**
 * Whether the page's `when` conditions hold in the context. Storage conditions use the cached
 * keys; before they load, a page that needs a key to exist is unavailable, and one that needs it
 * missing is available.
 */
const isPageAvailable = (extensionID: string, page: ExtensionPage, ids: PageContextIDs) => {
  const { when } = page;

  if (!when) return true;
  if (when.publishing !== undefined && when.publishing !== Boolean(ids.publishingCollectionID)) {
    return false;
  }

  if (when.storage) {
    const key = fillKey(when.storage.key, ids);
    const keys = storageKeys().get(getCacheKey(extensionID, getKeyPrefix(when.storage.key)));
    const exists = Boolean(key && keys?.has(key));

    return exists === when.storage.exists;
  }

  return true;
};

/**
 * Updates the cached keys after one of the extension's own storage writes, so its pages follow
 * without listing the keys again; prefixes that haven't loaded get the key when they load.
 */
const setPageStorageKey = (extensionID: string, key: string, exists: boolean): void => {
  setStorageKeys((current) => {
    const scope = `${extensionID}\n`;
    const cacheKeys = [...current.keys()].filter((cacheKey) => {
      return cacheKey.startsWith(scope) && key.startsWith(cacheKey.slice(scope.length));
    });

    if (!cacheKeys.length) return current;

    const next = new Map(current);

    for (const cacheKey of cacheKeys) {
      const keys = new Set(next.get(cacheKey));

      if (exists) keys.add(key);
      else keys.delete(key);

      next.set(cacheKey, keys);
    }

    return next;
  });
};
/** The page's path in the context, or null when the context lacks its ID or its `when` fails. */
const getAvailablePagePath = (
  workspaceID: string,
  extensionID: string,
  page: ExtensionPage,
  ids: PageContextIDs
): string | null => {
  const path = getExtensionPagePath(workspaceID, extensionID, page, ids);

  return path && isPageAvailable(extensionID, page, ids) ? path : null;
};
/** Sets how the workspace adds a context's collection and publishing collection; returns its removal. */
const setPageContextResolver = (resolver: PageContextResolver): (() => void) => {
  resolveContext = resolver;

  return () => {
    if (resolveContext === resolver) resolveContext = (ids) => ids;
  };
};
/** A page context with its collection and publishing collection, e.g. an entry's. */
const resolvePageContext = (ids: PageContextIDs): PageContextIDs => resolveContext(ids);
/** Whether the keys that the page's storage condition needs have loaded, e.g. before a route shows. */
const isPageAvailabilityKnown = (extensionID: string, page: ExtensionPage): boolean => {
  const key = page.when?.storage?.key;

  return !key || storageKeys().has(getCacheKey(extensionID, getKeyPrefix(key)));
};
/** Starts checking the conditions of a running extension's pages; null pages stop it. */
const setPageConditions = (extensionID: string, pages: ExtensionPage[] | null): void => {
  if (!pages) {
    extensionPages.delete(extensionID);
    setStorageKeys((current) => {
      return new Map([...current].filter(([key]) => !key.startsWith(`${extensionID}\n`)));
    });
    return;
  }

  extensionPages.set(extensionID, pages);
  void refreshPageAvailability(extensionID);
};

export {
  getAvailablePagePath,
  isPageAvailable,
  isPageAvailabilityKnown,
  refreshPageAvailability,
  resolvePageContext,
  setPageConditions,
  setPageContextResolver,
  setPageStorageKey
};
export type { PageContextIDs };
