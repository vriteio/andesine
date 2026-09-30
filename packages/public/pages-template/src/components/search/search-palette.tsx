import type { SearchContext } from "@andesine/pages";
import {
  type Answer,
  createAnswerClient,
  createSearchClient,
  type SearchGroup,
  type SearchItem
} from "@andesine/pages/client";
import { createSearchPalette } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, Match, Show, Switch, createUniqueId } from "solid-js";
import { Dialog } from "../primitives/dialog";
import { IconButton } from "../primitives/button";
import { Input } from "../primitives/input";
import { ScrollArea } from "../primitives/scroll-area";
import { Shortcut } from "../primitives/shortcut";
import { Tooltip } from "../primitives/tooltip";
import { SearchAnswer } from "./search-answer";
import { SearchNotice, SearchResults, SearchSkeleton } from "./search-results";

interface SearchPaletteProps {
  search: SearchContext;
}

/**
 * The header search field and the search dialog, after the Andesine app's search dialog.
 * `[data-search-trigger]` elements open it too.
 */
const SearchPalette: Component<SearchPaletteProps> = (props) => {
  const id = createUniqueId();
  const client = createSearchClient(props.search);
  const answerClient = props.search.answers && createAnswerClient(props.search.answers);
  const palette = createSearchPalette<SearchGroup[], SearchItem, Answer>({
    search: client.search,
    items: (groups) => groups.flatMap((group) => group.items),
    ask: answerClient?.ask
  });
  const { search, answer, navigation } = palette;
  const hasResults = (): boolean => {
    return (search.results() ?? []).some((group) => group.items.length || group.error);
  };
  const hasActiveOption = (): boolean => {
    const hasOptions = palette.items().length > 0 || palette.canAsk();

    return !palette.showingAnswer() && search.status() !== "loading" && hasOptions;
  };

  return (
    <>
      <button
        type="button"
        aria-keyshortcuts="Meta+K Control+K"
        class="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-gray-500 bg-gray-100 transition duration-200 ease-out @hover:bg-gray-200 focus-visible:bg-gray-200"
        onClick={() => palette.setOpen(true)}
      >
        <span aria-hidden="true" class="i-tabler:search h-4 w-4 shrink-0" />
        <span class="flex-1 text-start">Search</span>
        {/* The button has `aria-keyshortcuts`, so screen readers skip the key icons. */}
        <span aria-hidden="true">
          <Shortcut shortcut="$mod+K" ctrl={!palette.isApple()} class="text-xs text-gray-400" />
        </span>
      </button>
      <Dialog
        open={palette.open()}
        onOpenChange={palette.setOpen}
        label="Search documentation"
        initialFocus={palette.input}
        class="max-h-[80dvh] gap-2 p-1 md:p-1"
      >
        <div class="flex min-h-0 w-full flex-1 flex-col gap-2">
          <div
            class={clsx(
              "flex shrink-0 items-center gap-1 px-1 pt-1",
              // Without results, equal space below keeps the input centered in the card.
              search.status() === "idle" && !palette.showingAnswer() && "pb-1"
            )}
          >
            <Input
              ref={palette.inputRef}
              role={palette.showingAnswer() ? undefined : "combobox"}
              aria-label="Search query"
              aria-autocomplete={palette.showingAnswer() ? undefined : "list"}
              aria-expanded={palette.showingAnswer() ? undefined : palette.open()}
              aria-controls={palette.showingAnswer() ? undefined : `${id}-results`}
              aria-activedescendant={hasActiveOption() ? `${id}-${navigation.active()}` : undefined}
              placeholder={answer ? "Search or ask a question" : "Search"}
              maxLength={500}
              value={search.query()}
              class="min-w-0 flex-1 bg-transparent focus:shadow-none"
              onInput={(event) => search.setQuery(event.currentTarget.value)}
              onKeyDown={palette.onInputKeyDown}
            />
            <Tooltip content="Close">
              <IconButton
                icon="i-lucide:x"
                variant="text"
                text="soft"
                size="small"
                aria-label="Close search"
                onClick={() => palette.setOpen(false)}
              />
            </Tooltip>
          </div>
          <Show when={search.status() !== "idle" || palette.showingAnswer()}>
            <ScrollArea
              shadow
              class="min-h-0 flex-1 md:max-h-[min(60dvh,32rem)]"
              viewportRef={palette.resultsRef}
              contentClass="px-1 pb-1"
            >
              <div
                id={`${id}-results`}
                role={palette.showingAnswer() ? "region" : "listbox"}
                aria-label={palette.showingAnswer() ? "AI answer" : "Search results"}
                aria-busy={search.status() === "loading" || answer?.pending()}
              >
                <Switch>
                  <Match when={palette.showingAnswer() && answer}>
                    {(conversation) => (
                      <SearchAnswer
                        turns={conversation().turns()}
                        onOpen={() => palette.setOpen(false)}
                      />
                    )}
                  </Match>
                  <Match when={search.status() === "loading"}>
                    <SearchSkeleton />
                  </Match>
                  <Match when={search.status() === "error"}>
                    <SearchNotice
                      danger
                      icon="i-lucide:triangle-alert"
                      label="Search is unavailable"
                      sublabel="Check your connection and try again"
                    />
                  </Match>
                  <Match when={hasResults() || palette.canAsk()}>
                    <SearchResults
                      id={id}
                      groups={search.results() ?? []}
                      query={search.query().trim()}
                      active={navigation.active()}
                      indexOf={(item) => palette.items().indexOf(item)}
                      ask={
                        palette.canAsk()
                          ? {
                              index: palette.items().length,
                              followUp: Boolean(answer?.turns().length),
                              onAsk: palette.askQuery
                            }
                          : undefined
                      }
                      onActivate={navigation.setActive}
                      onOpen={() => palette.setOpen(false)}
                    />
                  </Match>
                  <Match when={!hasResults() && !palette.canAsk()}>
                    <SearchNotice
                      icon="i-tabler:search-off"
                      label="No results"
                      sublabel="Try a different search query"
                    />
                  </Match>
                </Switch>
              </div>
            </ScrollArea>
          </Show>
        </div>
      </Dialog>
    </>
  );
};

export { SearchPalette };
