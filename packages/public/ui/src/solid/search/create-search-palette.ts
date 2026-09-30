import { type Accessor, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { isApplePlatform } from "../../core/platform";
import { type Answer, type AnswerOptions, createAnswer } from "./create-answer";
import { type ListNavigation, createListNavigation } from "./create-list-navigation";
import { type Search, createSearch } from "./create-search";

interface SearchPaletteItem {
  href: string;
}

interface SearchPaletteOptions<TResults, TItem extends SearchPaletteItem, TAnswer> {
  search(query: string, signal: AbortSignal): Promise<TResults>;
  /** The results' items that open with Enter, in order. */
  items(results: TResults): TItem[];
  /** Answers the query as a question. Without it, the palette only searches. */
  ask?: AnswerOptions<TAnswer>["ask"];
  /** Wait after the last input change, in milliseconds. */
  delay?: number;
  /** Elements that open the palette on click. */
  triggerSelector?: string;
  /** URL parameter that opens the palette with a query, e.g. `?q=install`. */
  queryParam?: string;
  /** Maximum length of a query from the URL. */
  maxLength?: number;
}

interface SearchPalette<TResults, TItem extends SearchPaletteItem, TAnswer> {
  open: Accessor<boolean>;
  setOpen(open: boolean): void;
  search: Search<TResults>;
  /** Undefined without the `ask` option. */
  answer?: Answer<TAnswer>;
  items: Accessor<TItem[]>;
  /** The query can be asked as a question; the ask row is the list item after the items. */
  canAsk: Accessor<boolean>;
  /** The conversation shows in place of results: the input is empty and there are answers. */
  showingAnswer: Accessor<boolean>;
  navigation: ListNavigation;
  /** Shortcuts use Command, not Ctrl. */
  isApple: Accessor<boolean>;
  /** Asks the query as a question, and clears the input. */
  askQuery(): void;
  /** Goes to an item's page. */
  openItem(item: TItem): void;
  onInputKeyDown(event: KeyboardEvent): void;
  input: Accessor<HTMLInputElement | undefined>;
  inputRef(element: HTMLInputElement): void;
  /**
   * The scrolling element of the results. The active result, marked with a
   * `data-search-result` attribute that holds its index, and new answer text stay in view.
   */
  resultsRef(element: HTMLElement): void;
}

/**
 * The state of a search dialog: search as you type, AI answers with follow-ups, keyboard
 * navigation, the ⌘K or Ctrl+K shortcut, trigger elements, and a query in the URL.
 */
const createSearchPalette = <TResults, TItem extends SearchPaletteItem, TAnswer = never>(
  options: SearchPaletteOptions<TResults, TItem, TAnswer>
): SearchPalette<TResults, TItem, TAnswer> => {
  const [open, setOpen] = createSignal(false);
  const [isApple, setIsApple] = createSignal(true);
  const [input, setInput] = createSignal<HTMLInputElement>();
  const search = createSearch<TResults>({ search: options.search, delay: options.delay ?? 250 });
  const answer = options.ask && createAnswer<TAnswer>({ ask: options.ask });
  const items = (): TItem[] => {
    const results = search.results();

    return results === undefined ? [] : options.items(results);
  };
  const canAsk = (): boolean => Boolean(answer && search.query().trim());
  const showingAnswer = (): boolean => {
    return !search.query().trim() && Boolean(answer && answer.turns().length);
  };
  const openItem = (item: TItem): void => {
    setOpen(false);
    window.location.assign(item.href);
  };
  const askQuery = (): void => {
    const question = search.query().trim();

    if (!question || !answer) return;

    follow = true;
    answer.ask(question);
    search.setQuery("");
  };
  const navigation = createListNavigation({
    // Results of the previous query stay while the next loads, so they cannot be selected.
    count: () => (search.status() === "loading" ? 0 : items().length + (canAsk() ? 1 : 0)),
    onSelect: (index) => {
      const item = items()[index];

      if (item) {
        openItem(item);
      } else {
        askQuery();
      }
    }
  });

  let results: HTMLElement | undefined;
  let resumeSearch = false;
  // Streaming answers keep the view at the end until the reader scrolls up.
  let follow = true;

  createEffect(() => {
    search.results();
    navigation.setActive(0);
  });

  createEffect(
    on(open, (isOpen) => {
      if (isOpen) {
        if (resumeSearch) search.setQuery(search.query());

        resumeSearch = false;

        return;
      }

      resumeSearch = search.status() === "loading";
      search.cancel();
      answer?.cancel();
    })
  );

  createEffect(() => {
    answer?.turns();

    if (follow && results) queueMicrotask(() => results!.scrollTo({ top: results!.scrollHeight }));
  });

  onMount(() => {
    const url = new URL(window.location.href);
    const param = options.queryParam ?? "q";
    const query = url.searchParams.get(param)?.trim();
    const onShortcut = (event: KeyboardEvent): void => {
      const isShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);

      if (!isShortcut) return;

      event.preventDefault();
      setOpen(true);
    };
    const onClick = (event: MouseEvent): void => {
      const trigger = (event.target as Element).closest(
        options.triggerSelector ?? "[data-search-trigger]"
      );

      if (trigger) setOpen(true);
    };

    setIsApple(isApplePlatform());

    if (query) {
      url.searchParams.delete(param);
      window.history.replaceState(window.history.state, "", url);
      search.setQuery(query.slice(0, options.maxLength ?? 500));
      setOpen(true);
    }

    document.addEventListener("keydown", onShortcut);
    document.addEventListener("click", onClick);
    onCleanup(() => {
      document.removeEventListener("keydown", onShortcut);
      document.removeEventListener("click", onClick);
    });
  });

  return {
    open,
    setOpen,
    search,
    answer,
    items,
    canAsk,
    showingAnswer,
    navigation,
    isApple,
    askQuery,
    openItem,
    input,
    inputRef: setInput,
    resultsRef: (element) => {
      results = element;
      element.addEventListener("scroll", () => {
        follow = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
      });
    },
    onInputKeyDown: (event) => {
      const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

      // On touch keyboards, Enter closes the keyboard; results open with a tap.
      if (event.key === "Enter" && isTouch) {
        event.preventDefault();
        input()?.blur();

        return;
      }

      if (showingAnswer()) return;

      navigation.onKeyDown(event);
      queueMicrotask(() => {
        results
          ?.querySelector(`[data-search-result="${navigation.active()}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
    }
  };
};

export { createSearchPalette };
export type { SearchPaletteItem, SearchPaletteOptions, SearchPalette };
