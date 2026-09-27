import { type Accessor, createSignal, onCleanup } from "solid-js";

interface SearchOptions<T> {
  search(query: string, signal: AbortSignal): Promise<T>;
  /** Wait after the last input change, in milliseconds. */
  delay?: number;
}

interface Search<T> {
  query: Accessor<string>;
  results: Accessor<T | undefined>;
  status: Accessor<SearchStatus>;
  error: Accessor<unknown>;
  setQuery(query: string): void;
  /** Stops the pending search; the last results stay. */
  cancel(): void;
}

type SearchStatus = "idle" | "loading" | "done" | "error";

/**
 * Runs a search after input stops. A new query cancels the previous request, and only the
 * latest response updates the results.
 */
const createSearch = <T>(options: SearchOptions<T>): Search<T> => {
  const [query, setQueryValue] = createSignal("");
  const [results, setResults] = createSignal<T>();
  const [status, setStatus] = createSignal<SearchStatus>("idle");
  const [error, setError] = createSignal<unknown>();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const cancel = (): void => {
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;

    if (status() === "loading") setStatus(results() ? "done" : "idle");
  };
  const run = async (value: string): Promise<void> => {
    const current = new AbortController();

    controller = current;

    try {
      const found = await options.search(value, current.signal);

      if (controller !== current) return;

      setResults(() => found);
      setStatus("done");
    } catch (reason) {
      if (controller !== current || current.signal.aborted) return;

      setError(reason);
      setStatus("error");
    }
  };

  onCleanup(cancel);

  return {
    query,
    results,
    status,
    error,
    cancel,
    setQuery: (value) => {
      cancel();
      setQueryValue(value);

      if (!value.trim()) {
        setResults(undefined);
        setStatus("idle");

        return;
      }

      setStatus("loading");
      timer = setTimeout(() => run(value.trim()), options.delay ?? 200);
    }
  };
};

export { createSearch };
export type { SearchOptions, Search, SearchStatus };
