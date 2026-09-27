import type { SearchGroup, SearchItem } from "@andesine/pages/client";
import { getMatchPreview, matchesQuery } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, For, Show } from "solid-js";
import { HighlightedText } from "./highlighted-text";

interface SearchResultsProps {
  id: string;
  groups: SearchGroup[];
  query: string;
  active: number;
  /** The item's index in the list, across groups. */
  indexOf(item: SearchItem): number;
  /** Adds the "Tell me" row, which asks the query as a question. */
  ask?: SearchAskOptions;
  onActivate(index: number): void;
  onOpen(): void;
}

interface SearchAskOptions {
  /** The row's index in the list: after the items. */
  index: number;
  /** A follow-up to an earlier answer. */
  followUp: boolean;
  onAsk(): void;
}

interface SearchSkeletonProps {
  /** Title rows only, for answer sources. */
  compact?: boolean;
}

interface ResultLinkProps {
  href: string;
  label: string;
  sublabel?: string;
  onClick(): void;
}

interface SearchNoticeProps {
  icon: string;
  label: string;
  sublabel?: string;
  danger?: boolean;
}

interface ResultContentProps {
  icon: string;
  iconClass?: string;
  label: string;
  sublabel?: string;
  query?: string;
}

const rowClass =
  "relative flex min-h-11 w-full shrink-0 items-start gap-1 rounded-lg py-1 pl-0.5 text-left font-medium text-gray-700";
const skeletonWidths = [
  ["w-2/5", "w-3/5"],
  ["w-3/5", "w-4/5"],
  ["w-1/2", "w-3/4"]
];

/** Shows the matching heading path when only it matches; otherwise the excerpt. */
const getSublabel = (item: SearchItem, query: string): string => {
  const headings = item.headingPath.join(" › ");
  const onlyHeadingMatches =
    headings && matchesQuery(headings, query) && !matchesQuery(item.excerpt, query);

  return onlyHeadingMatches ? headings : item.excerpt;
};
const ResultContent: Component<ResultContentProps> = (props) => (
  <>
    <span class="flex h-5 w-6 shrink-0 items-center justify-center">
      <span
        aria-hidden="true"
        class={clsx("h-5 w-5", props.iconClass ?? "text-gray-400", props.icon)}
      />
    </span>
    <span class="flex min-w-0 flex-1 flex-col leading-tight">
      <span class="line-clamp-1">{props.label}</span>
      <span class="line-clamp-2 max-w-4/5 text-xs font-normal leading-tight text-gray-400">
        <Show when={props.sublabel} fallback="...">
          {(sublabel) => (
            <HighlightedText
              text={getMatchPreview(sublabel(), props.query ?? "")}
              query={props.query ?? ""}
            />
          )}
        </Show>
      </span>
    </span>
  </>
);
const SearchNotice: Component<SearchNoticeProps> = (props) => (
  <div role="status" class={rowClass}>
    <ResultContent
      icon={props.icon}
      iconClass={props.danger ? "text-red-500" : undefined}
      label={props.label}
      sublabel={props.sublabel}
    />
  </div>
);
const SearchSkeleton: Component<SearchSkeletonProps> = (props) => (
  <div aria-hidden="true" class="flex flex-col gap-0.5">
    <For each={skeletonWidths}>
      {([title, preview]) => (
        <div class={clsx("flex items-start gap-1.5 px-1 py-1", props.compact ? "h-7" : "h-14.5")}>
          <span class="h-5 w-5 animate-pulse rounded-md bg-gray-200" />
          <span class="flex flex-1 flex-col gap-1.5">
            <span class={clsx("h-5 animate-pulse rounded-md bg-gray-200", title)} />
            <Show when={!props.compact}>
              <span class={clsx("h-3.5 animate-pulse rounded-sm bg-gray-200", preview)} />
            </Show>
          </span>
        </div>
      )}
    </For>
  </div>
);
/** A plain result row, e.g. for answer sources. */
const ResultLink: Component<ResultLinkProps> = (props) => (
  <a
    href={props.href}
    class={clsx(
      rowClass,
      "select-none transition duration-200 ease-out media-mouse:(cursor-pointer hover:bg-gradient-to-r hover:from-gray-500/10 hover:to-transparent) focus-visible:(outline outline-2 outline-primary)"
    )}
    onClick={() => props.onClick()}
  >
    <ResultContent icon="i-lucide:file-text" label={props.label} sublabel={props.sublabel} />
  </a>
);
/** Result rows, grouped by source when there is more than one source. */
const SearchResults: Component<SearchResultsProps> = (props) => {
  const groups = (): SearchGroup[] => {
    return props.groups.filter((group) => group.items.length || group.error);
  };
  const labeled = (): boolean => groups().length > 1;

  return (
    // Without group labels, the rows form one list.
    <div class={clsx("flex flex-col", labeled() ? "gap-2" : "gap-0.5")}>
      <For each={groups()}>
        {(group) => (
          <div role="group" aria-label={group.label} class="flex flex-col gap-0.5">
            <Show when={labeled()}>
              <span class="truncate px-1 py-0.5 text-xs leading-normal text-gray-400">
                {group.label}
              </span>
            </Show>
            <Show when={group.error}>
              <SearchNotice
                danger
                icon="i-lucide:triangle-alert"
                label="Search is not available"
                sublabel={group.error}
              />
            </Show>
            <For each={group.items}>
              {(item) => {
                const index = (): number => props.indexOf(item);

                return (
                  <a
                    id={`${props.id}-${index()}`}
                    data-search-result={index()}
                    href={item.href}
                    role="option"
                    aria-label={item.title}
                    aria-selected={props.active === index()}
                    tabIndex={-1}
                    class={clsx(
                      rowClass,
                      "group select-none media-mouse:cursor-pointer",
                      props.active === index() &&
                        "md:(bg-gradient-to-r from-gray-500/10 to-transparent)"
                    )}
                    onPointerEnter={() => props.onActivate(index())}
                    onClick={() => props.onOpen()}
                  >
                    <ResultContent
                      icon="i-lucide:file-text"
                      label={item.title}
                      sublabel={getSublabel(item, props.query)}
                      query={props.query}
                    />
                  </a>
                );
              }}
            </For>
          </div>
        )}
      </For>
      <Show when={props.ask}>
        {(ask) => (
          <div role="group" aria-label="Ask AI" class="flex flex-col gap-0.5">
            <Show when={labeled()}>
              <span class="truncate px-1 py-0.5 text-xs leading-normal text-gray-400">Ask AI</span>
            </Show>
            <div
              id={`${props.id}-${ask().index}`}
              data-search-result={ask().index}
              role="option"
              aria-selected={props.active === ask().index}
              class={clsx(
                rowClass,
                "select-none media-mouse:cursor-pointer",
                props.active === ask().index &&
                  "md:(bg-gradient-to-r from-gray-500/10 to-transparent)"
              )}
              onPointerEnter={() => props.onActivate(ask().index)}
              onClick={() => ask().onAsk()}
            >
              <ResultContent
                icon="i-material-symbols:magic-button-outline"
                label={`Tell me “${props.query}”`}
                sublabel={ask().followUp ? "Ask a follow-up..." : "Ask a question..."}
              />
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export { SearchResults, SearchNotice, SearchSkeleton, ResultLink };
export type { SearchAskOptions };
