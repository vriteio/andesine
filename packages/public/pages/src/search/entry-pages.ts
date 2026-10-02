import type { PageResolver } from "./items";

// Each map loads once for each page view; a failed load is tried again on the next search.
const loaded = new Map<string, Promise<PageResolver>>();

/** Loads the map from entry IDs to page URLs that the build writes for a source. */
const loadEntryPages = (url: string): Promise<PageResolver> => {
  if (!loaded.has(url)) {
    const resolver = fetch(url).then(async (response): Promise<PageResolver> => {
      if (!response.ok) throw new Error("Search is not available now.");

      const hrefs = (await response.json()) as Record<string, string>;

      return (result) => hrefs[result.entryID];
    });

    loaded.set(url, resolver);
    resolver.catch(() => loaded.delete(url));
  }

  return loaded.get(url)!;
};

export { loadEntryPages };
