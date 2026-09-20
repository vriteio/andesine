import {
  createDebounced,
  createRef,
  createScrollShadowController,
  Dialog,
  Dropdown,
  Input,
  ScrollShadow
} from "@andesine/components";
import { createMediaQuery } from "@solid-primitives/media";
import { createAsync, useNavigate, useSearchParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Match,
  on,
  onCleanup,
  Show,
  Switch
} from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { currentSearchQuery, type SearchPropertyFilter } from "#web/lib/data";
import type { SearchNavigationState } from "#web/lib/search-navigation";
import {
  AddSearchFilter,
  getSearchPropertyFilters,
  type PropertyFilterDraft,
  SearchFilters
} from "./search-filters";
import { SearchAnswerPanel, type SearchAnswerData } from "./search-answer";
import { SearchResultNotice, SearchResults, SearchResultsSkeleton } from "./search-results";
import { withWorkspacePanelParams } from "../panel-navigation";
import { streamSearchAnswer } from "./answer-stream";

interface SearchDialogProps {
  opened: boolean;
  onClose(): void;
}
interface SearchResponse {
  error?: true;
  requestKey: string;
  results: Awaited<ReturnType<typeof currentSearchQuery>>["results"];
}
interface SearchRequest {
  filters: SearchPropertyFilter[];
  query: string;
}
interface AskRequest extends SearchRequest {
  requestID: number;
  signal: AbortSignal;
  workspaceID: string;
}

const EMPTY_SEARCH_RESPONSE: SearchResponse = { requestKey: "", results: [] };

const SearchDialog: Component<SearchDialogProps> = (props) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workspaceID } = useWorkspace();
  const md = createMediaQuery("(min-width: 768px)");
  const [inputRef, setInputRef] = createRef<HTMLInputElement | null>(null);
  const [resultsRef, setResultsRef] = createRef<HTMLDivElement>(null!);
  const [query, setQuery] = createSignal("");
  const [filterDrafts, setFilterDrafts] = createSignal<PropertyFilterDraft[]>([]);
  const [answer, setAnswer] = createSignal<SearchAnswerData>();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [requestPending, setRequestPending] = createSignal(false);
  const [latestRequestID, setLatestRequestID] = createRef(0);
  const [askRequestID, setAskRequestID] = createRef(0);
  const [askController, setAskController] = createRef<AbortController | undefined>(undefined);
  const [followAnswer, setFollowAnswer] = createRef(true);
  const scrollShadowController = createScrollShadowController();
  const normalizedQuery = () => query().trim();
  const activeFilters = createMemo(() => getSearchPropertyFilters(filterDrafts()));
  const searchRequest = createMemo<SearchRequest>(() => ({
    filters: activeFilters(),
    query: normalizedQuery()
  }));
  const debouncedSearchRequest = createDebounced(searchRequest, 250);
  const getRequestKey = (request: SearchRequest) => JSON.stringify(request);
  const focusInput = () => {
    if (!md()) return;

    queueMicrotask(() => inputRef()?.focus());
  };
  const searchResponse = createAsync(
    async (): Promise<SearchResponse> => {
      const request = debouncedSearchRequest();
      const currentWorkspaceID = workspaceID();
      const requestKey = getRequestKey(request);

      if (!currentWorkspaceID) return EMPTY_SEARCH_RESPONSE;

      const requestID = latestRequestID() + 1;

      setLatestRequestID(requestID);
      setRequestPending(true);

      try {
        const response = await currentSearchQuery({
          filters: request.filters,
          query: request.query,
          workspaceID: currentWorkspaceID
        });

        const nextResponse = { requestKey, results: response.results };

        return nextResponse;
      } catch (error) {
        const nextResponse: SearchResponse = { requestKey, results: [], error: true };

        console.error(error);

        return nextResponse;
      } finally {
        if (requestID === latestRequestID()) {
          setRequestPending(false);
        }
      }
    },
    { initialValue: EMPTY_SEARCH_RESPONSE }
  );
  const response = createMemo(() => {
    const latestResponse = searchResponse.latest;

    if (latestResponse.requestKey !== getRequestKey(searchRequest())) {
      return EMPTY_SEARCH_RESPONSE;
    }

    return latestResponse;
  });
  const results = () => response().results;
  const searching = () => {
    const currentRequest = searchRequest();

    return Boolean(
      getRequestKey(currentRequest) !== getRequestKey(debouncedSearchRequest()) || requestPending()
    );
  };
  const askMutation = createMutation(() => ({
    retry: false,
    mutationFn: async (request: AskRequest) => {
      if (request.signal.aborted) return;

      try {
        await streamSearchAnswer(
          { question: request.query, filters: request.filters, history: [] },
          {
            signal: request.signal,
            workspaceID: request.workspaceID,
            onUpdate: (answer) => {
              if (request.requestID !== askRequestID()) return;

              setAnswer({ answer, question: request.query });
            }
          }
        );
      } catch (error) {
        if (request.signal.aborted) return;

        throw error;
      } finally {
        if (request.requestID === askRequestID()) setAskController(undefined);
      }
    },
    onSuccess: (_answer, request) => {
      if (request.requestID !== askRequestID()) return;

      if (props.opened) focusInput();
    }
  }));
  const showingAnswer = () =>
    !normalizedQuery() && Boolean(answer() || askMutation.isPending || askMutation.isError);
  const cancelAnswer = () => {
    setAskRequestID(askRequestID() + 1);
    askController()?.abort();
    setAskController(undefined);
    askMutation.reset();
  };
  const setQueryValue = (value: string) => {
    cancelAnswer();
    setQuery(value);
    setAnswer();
  };
  const updateFilterDrafts = (filters: PropertyFilterDraft[]) => {
    cancelAnswer();
    setFilterDrafts(filters);
    setAnswer();
  };
  const openResult = (result: SearchResponse["results"][number]) => {
    const state: SearchNavigationState = {
      searchTarget: {
        entryID: result.entryID,
        headingPath: result.headingPath,
        query: normalizedQuery(),
        snippet: result.snippet
      }
    };

    navigate(withWorkspacePanelParams(`/${workspaceID()}/${result.entryID}`, searchParams), {
      state
    });
    props.onClose();
  };
  const submitQuestion = () => {
    const question = normalizedQuery();
    const currentWorkspaceID = workspaceID();

    if (!question || !currentWorkspaceID || askMutation.isPending) return;

    const controller = new AbortController();

    cancelAnswer();
    setAskController(controller);
    setFollowAnswer(true);
    setAnswer({ question, answer: { answer: "", sources: [], sourcesReceived: false } });
    askMutation.mutate({
      filters: activeFilters(),
      query: question,
      requestID: askRequestID(),
      signal: controller.signal,
      workspaceID: currentWorkspaceID
    });
    setQuery("");
  };
  const selectResult = (index: number) => {
    setSelectedIndex(index);
    queueMicrotask(() => {
      resultsRef()
        .querySelector(`[data-search-result="${index}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };
  const scrollAnswerToEnd = () => {
    queueMicrotask(() => {
      const container = resultsRef();

      if (!container || !props.opened || !followAnswer()) return;

      container.scrollTop = container.scrollHeight;
    });
  };
  const handleInputKeyDown = (event: KeyboardEvent) => {
    const lastResultIndex = Math.max(results().length - (normalizedQuery() ? 0 : 1), 0);

    event.stopPropagation();

    if (!md() && event.key === "Enter") {
      event.preventDefault();
      inputRef()?.blur();

      return;
    }

    if (showingAnswer()) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectResult(selectedIndex() >= lastResultIndex ? 0 : selectedIndex() + 1);

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectResult(selectedIndex() <= 0 ? lastResultIndex : selectedIndex() - 1);

      return;
    }

    if (event.key === "Enter") {
      const selectedResult = results()[selectedIndex()];

      if (selectedResult) {
        event.preventDefault();
        openResult(selectedResult);
      } else if (selectedIndex() === results().length && normalizedQuery()) {
        event.preventDefault();
        submitQuestion();
      }
    }
  };

  createEffect(
    on([() => props.opened, workspaceID], ([opened, currentWorkspaceID], previous) => {
      const workspaceChanged = currentWorkspaceID !== previous?.[1];
      const interrupted = askMutation.isPending;

      if (!opened || workspaceChanged) {
        cancelAnswer();
        if (interrupted || workspaceChanged) setAnswer();
      }

      if (opened) focusInput();
    })
  );
  onCleanup(cancelAnswer);
  createEffect(() => {
    searchRequest();
    setSelectedIndex(0);
  });
  createEffect(() => {
    if (answer() || askMutation.isPending) {
      scrollAnswerToEnd();
    }
  });
  createEffect(() => {
    response();
    answer();
    Boolean(askMutation.isPending);
    Boolean(askMutation.isError);

    queueMicrotask(() => scrollShadowController.processScrollState());
  });

  const content = () => (
    <div class="flex min-h-0 w-full flex-1 flex-col gap-2">
      <div class="flex shrink-0 items-center gap-1 px-1 pt-1">
        <Input
          ref={(input) => {
            setInputRef(input);
            if (props.opened) focusInput();
          }}
          value={query()}
          setValue={setQueryValue}
          placeholder="Search or ask a question"
          aria-label="Search query"
          size="small"
          maxLength={500}
          onKeyDown={handleInputKeyDown}
          role={showingAnswer() ? undefined : "combobox"}
          class="bg-transparent focus:shadow-none"
          aria-autocomplete={showingAnswer() ? undefined : "list"}
          aria-controls={showingAnswer() ? undefined : "workspace-search-results"}
          aria-expanded={showingAnswer() ? undefined : props.opened}
          aria-activedescendant={
            !showingAnswer() &&
            !searching() &&
            !response().error &&
            (normalizedQuery() || results().length > 0)
              ? `workspace-search-result-${selectedIndex()}`
              : undefined
          }
        />
        <AddSearchFilter filters={filterDrafts()} setFilters={updateFilterDrafts} />
      </div>
      <SearchFilters filters={filterDrafts()} setFilters={updateFilterDrafts} />
      <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <ScrollShadow controller={scrollShadowController} scrollableContainerRef={resultsRef} />
        <div
          id="workspace-search-results"
          ref={setResultsRef}
          role={showingAnswer() ? "region" : "listbox"}
          aria-label={showingAnswer() ? "AI answer" : undefined}
          aria-busy={askMutation.isPending || searching()}
          onScroll={(event) => {
            const container = event.currentTarget;
            const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;

            setFollowAnswer(remaining < 48);
          }}
          class="relative z-0 flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-1 pb-1 md:max-h-[min(60dvh,32rem)]"
        >
          <Switch>
            <Match when={showingAnswer()}>
              <SearchAnswerPanel
                data={answer()}
                loading={askMutation.isPending}
                error={askMutation.isError ? askMutation.error : undefined}
                openResult={openResult}
                question={askMutation.variables?.query}
              />
            </Match>
            <Match when={searching()}>
              <SearchResultsSkeleton />
            </Match>
            <Match when={response().error}>
              <SearchResultNotice
                color="danger"
                icon="i-lucide:triangle-alert"
                label="Search is unavailable"
                sublabel="Check your connection and try again"
              />
            </Match>
            <Match when={!searching()}>
              <SearchResults
                query={normalizedQuery()}
                results={results()}
                selectedIndex={selectedIndex()}
                setSelectedIndex={setSelectedIndex}
                openResult={openResult}
                askAI={submitQuestion}
              />
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  );

  return (
    <Show
      when={md()}
      fallback={
        <Dropdown
          title="Search"
          class="md:hidden"
          anchorPoint={{ x: 0, y: 0 }}
          mobileSheetDragFromContent={false}
          opened={props.opened}
          setOpened={(opened) => {
            if (!opened) props.onClose();
          }}
          cardProps={{ style: { "min-height": "60dvh" } }}
          portal
        >
          {content()}
        </Dropdown>
      }
    >
      <Dialog
        opened={props.opened}
        onOverlayClick={props.onClose}
        backdrop={false}
        size="xlarge"
        cardClass="max-h-[80dvh] p-1 gap-2"
        wrapperClass="absolute top-[10dvh]"
        aria-label="Search workspace"
        portal
      >
        {content()}
      </Dialog>
    </Show>
  );
};

export { SearchDialog };
