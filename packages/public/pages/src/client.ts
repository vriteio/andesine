import type { AndesineAPIContext, SearchContext, SearchSourceContext } from "./context";
import { loadEntryPages } from "./search/entry-pages";
import { toSearchItems } from "./search/items";
import type { SearchGroup, SearchItem } from "./search/types";

interface SearchClient {
  /** Searches all sources. Aborting the signal cancels the pending requests. */
  search(query: string, signal: AbortSignal): Promise<SearchGroup[]>;
}

interface Pagefind {
  options(options: { baseUrl: string }): Promise<void>;
  search(
    query: string,
    options: { filters: Record<string, string> }
  ): Promise<{ results: Array<{ id: string; data(): Promise<PagefindResultData> }> } | null>;
}

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string };
  sub_results?: Array<{ url: string; title: string; excerpt: string }>;
}

const limit = 8;

/** Removes the `<mark>` and other tags from Pagefind excerpts. */
const toText = (html: string): string => {
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
};
const createSearchClient = (context: SearchContext): SearchClient => {
  let pagefind: Promise<Pagefind> | undefined;

  const loadPagefind = (): Promise<Pagefind> => {
    pagefind ??= import(/* @vite-ignore */ `${context.pagefind}pagefind.js`).then(
      async (module: Pagefind) => {
        await module.options({ baseUrl: context.pagefind.replace(/pagefind\/$/, "") });

        return module;
      },
      (error) => {
        pagefind = undefined;
        throw error;
      }
    );

    return pagefind;
  };
  const searchPagefind = async (
    source: SearchSourceContext,
    query: string
  ): Promise<SearchItem[]> => {
    const found = await (await loadPagefind()).search(query, { filters: { source: source.id } });

    return Promise.all(
      (found?.results ?? []).slice(0, limit).map(async (result) => {
        const data = await result.data();
        // The first sub-result is the best matching section of the page.
        const section = data.sub_results?.find((item) => item.url !== data.url);

        return {
          id: result.id,
          href: section?.url ?? data.url,
          title: data.meta.title ?? "Untitled",
          excerpt: toText(section?.excerpt ?? data.excerpt),
          headingPath: section ? [section.title] : []
        };
      })
    );
  };
  // With a publishable key, the browser searches through the API, and links results itself.
  const searchAPI = async (
    api: AndesineAPIContext,
    query: string,
    signal: AbortSignal
  ): Promise<SearchItem[]> => {
    const [resolve, response] = await Promise.all([
      loadEntryPages(api.pages),
      fetch(`${api.url}/search/published`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${api.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, collectionID: api.collection, channel: "published", limit }),
        signal
      })
    ]);

    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? "Too many searches. Try again soon."
          : "Search is not available now."
      );
    }

    const { results } = (await response.json()) as { results: Parameters<typeof toSearchItems>[0] };

    return toSearchItems(results, resolve);
  };
  const searchAndesine = async (
    source: SearchSourceContext,
    query: string,
    signal: AbortSignal
  ): Promise<SearchItem[]> => {
    if (source.api) return searchAPI(source.api, query, signal);

    const response = await fetch(context.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source.id, query, limit }),
      signal
    });
    const body = (await response.json().catch(() => ({}))) as {
      items?: SearchItem[];
      error?: string;
    };

    if (!response.ok) throw new Error(body.error ?? "Search is not available now.");

    return body.items ?? [];
  };

  return {
    search: (query, signal) => {
      return Promise.all(
        context.sources.map(async (source): Promise<SearchGroup> => {
          const group = { sourceID: source.id, label: source.label };

          try {
            const items =
              source.type === "pagefind"
                ? await searchPagefind(source, query)
                : await searchAndesine(source, query, signal);

            return { ...group, items };
          } catch (error) {
            signal.throwIfAborted();

            return { ...group, items: [], error: (error as Error).message };
          }
        })
      );
    }
  };
};

export { createSearchClient };
export { createAnswerClient, groupAnswerSources } from "./search/answer-client";
export { renderAnswer } from "./search/markdown";
export type { SearchClient };
export type { AnswerClient, AnswerHistoryTurn, AnswerSourceGroup } from "./search/answer-client";
export type { SearchGroup, SearchItem, Answer, AnswerSource, AnswerMessage } from "./search/types";
