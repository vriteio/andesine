import { type Answer, groupAnswerSources, renderAnswer } from "@andesine/pages/client";
import type { AnswerTurn } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, For, Index, Show } from "solid-js";
import { ResultLink, SearchSkeleton } from "./search-results";

interface SearchAnswerProps {
  turns: Array<AnswerTurn<Answer>>;
  /** Called when a link in an answer opens a page. */
  onOpen(): void;
}

interface AnswerTurnViewProps {
  turn: AnswerTurn<Answer>;
  onOpen(): void;
}

const lineWidths = ["w-full", "w-3/5", "w-4/5"];

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error && error.message ? error.message : "Try again later.";
};
const TextSkeleton: Component = () => (
  <div aria-hidden="true" class="flex w-full max-w-9/10 flex-col gap-1.5 pl-1">
    <For each={lineWidths}>
      {(width) => <span class={clsx("h-3.5 animate-pulse rounded-sm bg-gray-200", width)} />}
    </For>
  </div>
);
const AnswerTurnView: Component<AnswerTurnViewProps> = (props) => {
  const answer = (): Answer | undefined => props.turn.answer;
  const loading = (): boolean => props.turn.status === "loading";
  // Pages open with a full navigation, but links to the current page only change the hash.
  const onClick = (event: MouseEvent): void => {
    const link = (event.target as Element).closest("a");

    if (link && !link.target) props.onOpen();
  };

  return (
    <div class="flex flex-col gap-2" onClick={onClick}>
      <div class="flex justify-end">
        <p class="max-w-9/10 whitespace-pre-wrap rounded-lg bg-gray-100 px-2 py-1 text-sm leading-relaxed">
          {props.turn.question}
        </p>
      </div>
      <Show
        when={answer()?.text}
        fallback={
          <Show when={loading()}>
            <TextSkeleton />
          </Show>
        }
      >
        <div
          class="prose prose-sm max-w-9/10 break-words pl-1 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          innerHTML={renderAnswer(answer()!)}
        />
      </Show>
      <Show when={loading() && !answer()?.sourcesReceived}>
        <SearchSkeleton compact />
      </Show>
      <Show when={answer()?.sources.length}>
        <ul aria-label="Answer sources" class="m-0 flex list-none flex-col gap-0.5 p-0">
          <For each={groupAnswerSources(answer()!.sources)}>
            {(group) => (
              <li class="flex items-start gap-1">
                <div class="min-w-0 flex-1">
                  <ResultLink
                    href={group.href}
                    label={group.sources[0]!.title || "Untitled"}
                    sublabel={group.sources[0]!.collectionPath.join(" › ") || undefined}
                    onClick={() => props.onOpen()}
                  />
                </div>
                <div class="flex max-w-1/2 shrink-0 flex-wrap justify-end gap-1 py-1 pr-1">
                  <For each={group.sources}>
                    {(source) => {
                      const section = source.headingPath.join(" › ") || source.title;

                      return (
                        <a
                          href={source.href}
                          title={section}
                          aria-label={`Reference ${source.id}: ${source.title}, ${section}`}
                          class="font-mono text-xs text-gray-400 focus-visible:(outline outline-2 outline-primary) media-mouse:hover:(text-gray-600 underline)"
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
      <Show when={props.turn.status === "error"}>
        <div
          role="alert"
          class="flex min-h-24 flex-col items-center justify-center gap-2 text-center"
        >
          <span aria-hidden="true" class="i-lucide:triangle-alert h-6 w-6 text-red-500" />
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">Ask AI failed</span>
            <span class="max-w-sm text-xs text-gray-400">{getErrorMessage(props.turn.error)}</span>
          </span>
        </div>
      </Show>
    </div>
  );
};
/** The AI answer conversation, after the Andesine app's search answer. */
const SearchAnswer: Component<SearchAnswerProps> = (props) => (
  <div class="flex flex-col gap-4">
    <Index each={props.turns}>
      {(turn) => <AnswerTurnView turn={turn()} onOpen={props.onOpen} />}
    </Index>
  </div>
);

export { SearchAnswer };
