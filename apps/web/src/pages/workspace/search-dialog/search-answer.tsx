import { Skeleton } from "@andesine/components";
import { type Component, createMemo, For, Show } from "solid-js";
import { Markdown } from "#web/components/markdown";
import type { SearchAnswer as SearchAnswerResult } from "./answer-stream";
import { SearchResultLink, SearchResultsSkeleton } from "./search-results";

interface SearchAnswerData {
  answer: SearchAnswerResult;
  question: string;
}

interface SearchAnswerProps extends SearchAnswerData {
  loading: boolean;
  openResult(result: SearchAnswerSource): void;
}
interface SearchAnswerSourceGroup {
  entryID: string;
  sources: SearchAnswerSource[];
}
interface SearchAnswerPanelProps {
  data?: SearchAnswerData;
  error?: unknown;
  loading: boolean;
  openResult: SearchAnswerProps["openResult"];
  question?: string;
}
interface SearchAnswerSkeletonProps {
  question: string;
}
interface SearchErrorProps {
  message: string;
  title: string;
}

type SearchAnswerSource = SearchAnswerData["answer"]["sources"][number];

const groupAnswerSources = (sources: SearchAnswerSource[]): SearchAnswerSourceGroup[] => {
  const groups = new Map<string, SearchAnswerSourceGroup>();

  for (const source of sources) {
    const group = groups.get(source.entryID);

    if (group) {
      group.sources.push(source);
    } else {
      groups.set(source.entryID, { entryID: source.entryID, sources: [source] });
    }
  }

  return [...groups.values()];
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (!error) return;

  return error instanceof Error && error.message
    ? error.message
    : "Ask AI is unavailable. Try again later.";
};
const linkAnswerReferences = (answer: SearchAnswerProps["answer"]): string => {
  const sourceIDs = new Set(answer.sources.map(({ id }) => String(id)));

  return answer.answer.replace(/\[(\d+)\](?!\()/g, (reference, id: string) => {
    if (!sourceIDs.has(id)) return reference;

    return `[${reference}](#ask-ai-source-${id})`;
  });
};
const SearchError: Component<SearchErrorProps> = (props) => (
  <div class="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
    <div class="h-6 w-6 text-red-500 i-lucide:triangle-alert" />
    <div class="flex flex-col gap-0.5">
      <p class="text-sm font-medium">{props.title}</p>
      <p class="max-w-sm text-xs text-gray-400">{props.message}</p>
    </div>
  </div>
);

const SearchAnswerTextSkeleton: Component = () => (
  <div class="flex w-full max-w-9/10 flex-col gap-1.5 pl-1">
    <Skeleton
      class={[
        "h-3.5 w-full rounded-[0.25rem]",
        "h-3.5 w-3/5 rounded-[0.25rem]",
        "h-3.5 w-4/5 rounded-[0.25rem]"
      ]}
    />
  </div>
);
const SearchAnswer: Component<SearchAnswerProps> = (props) => {
  const sources = createMemo(() => props.answer.sources);
  const sourceGroups = createMemo(() => groupAnswerSources(sources()));

  return (
    <div class="flex flex-col gap-2">
      <div class="flex justify-end">
        <p class="max-w-9/10 whitespace-pre-wrap rounded-lg bg-gray-100 px-2 py-1 text-sm leading-relaxed">
          {props.question}
        </p>
      </div>
      <Show
        when={props.answer.answer}
        fallback={
          <Show when={props.loading}>
            <SearchAnswerTextSkeleton />
          </Show>
        }
      >
        <div class="flex items-start gap-2 max-w-9/10">
          <Markdown
            class="min-w-0 flex-1 ![&>*:first-child]:mt-0 ![&>*:last-child]:mb-0"
            content={linkAnswerReferences(props.answer)}
            onLinkClick={(href, event) => {
              const sourceID = Number(href.match(/^#ask-ai-source-(\d+)$/)?.[1]);
              const source = props.answer.sources.find(({ id }) => id === sourceID);

              if (!source) return;

              event.preventDefault();
              props.openResult(source);
            }}
          />
        </div>
      </Show>
      <Show when={props.loading && !props.answer.sourcesReceived}>
        <SearchResultsSkeleton preview={false} />
      </Show>
      <Show when={sourceGroups().length > 0}>
        <ul aria-label="Answer sources" class="m-0 flex list-none flex-col gap-0.5 p-0">
          <For each={sourceGroups()}>
            {(group) => (
              <li class="flex items-start gap-1">
                <div class="min-w-0 flex-1">
                  <SearchResultLink
                    icon="i-lucide:file-text"
                    label={group.sources[0].title || "Untitled"}
                    sublabel={group.sources[0].collectionPath.join(" › ") || "Entry content"}
                    onClick={() => props.openResult(group.sources[0])}
                  />
                </div>
                <div class="flex max-w-1/2 shrink-0 flex-wrap justify-end gap-1 pr-1 py-1 ">
                  <For each={group.sources}>
                    {(source) => {
                      const section = source.headingPath.join(" › ") || "Entry content";

                      return (
                        <a
                          href={`#ask-ai-source-${source.id}`}
                          title={section}
                          aria-label={`Reference ${source.id}: ${source.title || "Untitled"}, ${section}`}
                          class="font-mono text-xs text-gray-400 media-mouse:hover:text-gray-600 media-mouse:hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                          onClick={(event) => {
                            event.preventDefault();
                            props.openResult(source);
                          }}
                        >
                          [{source.id}]
                        </a>
                      );
                    }}
                  </For>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
};
const SearchAnswerSkeleton: Component<SearchAnswerSkeletonProps> = (props) => (
  <div class="flex flex-col gap-2">
    <div class="flex justify-end">
      <p class="max-w-9/10 whitespace-pre-wrap rounded-lg bg-gray-100 px-2 py-1 text-sm leading-relaxed">
        {props.question}
      </p>
    </div>
    <SearchAnswerTextSkeleton />
    <SearchResultsSkeleton preview={false} />
  </div>
);
const SearchAnswerPanel: Component<SearchAnswerPanelProps> = (props) => (
  <div class="flex flex-col gap-2">
    <Show when={props.data}>
      {(data) => (
        <SearchAnswer
          answer={data().answer}
          question={data().question}
          loading={props.loading}
          openResult={props.openResult}
        />
      )}
    </Show>
    <Show when={props.loading && !props.data}>
      <SearchAnswerSkeleton question={props.question || ""} />
    </Show>
    <Show when={getErrorMessage(props.error)} keyed>
      {(error) => <SearchError title="Ask AI failed" message={error} />}
    </Show>
  </div>
);

export { SearchAnswerPanel };
export type { SearchAnswerData };
