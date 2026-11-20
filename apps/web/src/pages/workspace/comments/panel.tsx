import { createRef, ScrollShadow, ToggleGroup } from "@andesine/components";
import type { EditorCommentThread } from "@andesine/editor";
import { ThreadCard } from "@andesine/editor/comments";
import clsx from "clsx";
import { type Component, createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { useComments } from "./context";
import { CommentsSkeleton } from "./skeleton";
import { ThreadTitle } from "./thread-title";

type CommentsFilter = "open" | "resolved";

const FILTER_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" }
];

const CommentsPanel: Component = () => {
  const { comments, active, activate, activatedInPanel, order, loading, draft } = useComments();
  const [filter, setFilter] = createSignal<CommentsFilter>("open");
  // Title hovered, or chosen with the arrow keys.
  const [selectedThread, setSelectedThread] = createSignal<string | null>(null);
  const [scrollContainer, setScrollContainer] = createRef<HTMLElement | null>(null);

  let panel: HTMLDivElement | undefined;

  const draftThread = createMemo((): EditorCommentThread | null => {
    const current = draft();

    return (
      current && {
        id: current.threadID,
        anchor: null,
        blockID: null,
        resolved: false,
        quote: current.quote,
        status: "active",
        comments: []
      }
    );
  });
  // Threads without a highlight go last, by start time.
  const threads = createMemo((): EditorCommentThread[] => {
    const positions = new Map(order().map(({ threadID }, index) => [threadID, index]));
    const position = (thread: EditorCommentThread) => positions.get(thread.id) ?? Infinity;
    const started = (thread: EditorCommentThread) => thread.comments[0]?.createdAt ?? "";
    const resolved = filter() === "resolved";

    const newThread = draftThread();
    const draftThreads = newThread ? [newThread] : [];

    return [...(comments()?.threads ?? []), ...draftThreads]
      .filter((thread) => thread.resolved === resolved)
      .sort((a, b) => position(a) - position(b) || started(a).localeCompare(started(b)));
  });
  const threadIDs = createMemo(() => threads().map(({ id }) => id));
  const threadsByID = createMemo(() => new Map(threads().map((thread) => [thread.id, thread])));
  // Only while it's in the shown list.
  const shownActive = () => {
    const threadID = active();

    return threadID && threadsByID().has(threadID) ? threadID : null;
  };
  const hasResolved = createMemo(() => {
    return Boolean(comments()?.threads.some(({ resolved }) => resolved));
  });
  const blocks = createMemo(() => new Map(order().map(({ threadID, block }) => [threadID, block])));
  const focusReply = (threadID: string) => {
    requestAnimationFrame(() => {
      const thread = panel?.querySelector(`[data-comment-panel-thread="${threadID}"]`);

      thread?.querySelector<HTMLElement>(".tiptap")?.focus({ preventScroll: true });
      // The title too, not only the field.
      thread?.scrollIntoView({ block: "nearest" });
    });
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    // Keys on controls, e.g. Resolve, are theirs.
    if (event.target !== panel) return;

    const threadIDsShown = threadIDs();
    const current = threadIDsShown.indexOf(selectedThread() ?? shownActive() ?? "");
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const selected = selectedThread();

    if (step) {
      const start = step > 0 ? -1 : threadIDsShown.length;
      const index = Math.min(
        Math.max((current === -1 ? start : current) + step, 0),
        threadIDsShown.length - 1
      );
      const threadID = threadIDsShown[index];

      event.preventDefault();
      setSelectedThread(threadID ?? null);
      panel
        ?.querySelector(`[data-comment-panel-thread="${threadID}"]`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      activate(selected, true);
      focusReply(selected);
    } else if (event.key === "Escape") {
      setSelectedThread(shownActive());
      activate(null, false);
    }
  };
  const closeFromReply = (threadID: string) => {
    activate(null, false);
    setSelectedThread(threadID);
    panel?.focus();
  };

  createEffect(() => {
    if (!hasResolved()) setFilter("open");
  });
  // Closes the thread once resolved, e.g. by someone else.
  createEffect(
    on(
      () => {
        const threadID = active();
        const thread = comments()?.threads.find(({ id }) => id === threadID);

        return { threadID, resolved: Boolean(thread?.resolved) };
      },
      (current, previous) => {
        const isResolvedNow = previous?.threadID === current.threadID && !previous.resolved;

        if (current.resolved && isResolvedNow) activate(null, false);
      }
    )
  );
  createEffect(
    on(draft, (current, previous) => {
      if (current) {
        setFilter("open");
        activate(current.threadID, true);
        focusReply(current.threadID);
      } else if (previous && active() === previous.threadID) {
        activate(null, false);
      }
    })
  );
  createEffect(
    on(active, (threadID) => {
      if (!threadID || activatedInPanel()) return;

      const card = scrollContainer()?.querySelector(`[data-comment-thread-card="${threadID}"]`);

      card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    })
  );

  return (
    <div
      ref={panel}
      class="relative flex min-h-0 w-full flex-1 outline-none"
      tabindex="-1"
      onKeyDown={handleKeyDown}
      // By path, as opening a thread can remove the target.
      onPointerDown={(event) => {
        const isOnThread = event.composedPath().some((element) => {
          return (
            element instanceof Element &&
            element.matches("[data-comment-panel-thread], [data-comment-menu]")
          );
        });

        if (!isOnThread) activate(null, false);
      }}
      onPointerMove={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        const threadID = target
          ?.closest("[data-comment-thread-title]")
          ?.getAttribute("data-comment-thread-title");

        if (event.pointerType === "mouse") setSelectedThread(threadID ?? null);
      }}
      onPointerLeave={(event) => event.pointerType === "mouse" && setSelectedThread(null)}
    >
      <div class="pointer-events-none absolute inset-y-0 left-0 right-3 overflow-hidden">
        <ScrollShadow
          color="panel"
          offset={{ top: hasResolved() ? "4.5rem" : "2.25rem" }}
          scrollableContainerRef={scrollContainer}
        />
      </div>
      <div
        ref={setScrollContainer}
        class="relative flex min-h-0 w-full flex-1 flex-col scrollbar-panel scrollbar-hover overflow-y-auto overflow-x-hidden px-1 pb-2"
      >
        <div class="sticky top-0 z-20 -ml-1 flex h-9 shrink-0 items-center bg-white pl-1 md:bg-gray-100">
          <h2 class="text-2xl font-semibold">Comments</h2>
        </div>
        <Show when={hasResolved()}>
          <div class="sticky top-9 z-20 -ml-1 flex shrink-0 bg-white pb-2 pl-1 md:bg-gray-100">
            <ToggleGroup
              value={filter()}
              setValue={(value) => {
                setFilter(value === "resolved" ? "resolved" : "open");
                activate(null, false);
              }}
              options={FILTER_OPTIONS}
              wrapperClass="p-0.5 gap-0.5"
              itemClass="px-2 py-0.5 text-sm"
            />
          </div>
        </Show>
        <div class="flex flex-col gap-3">
          <Show when={!loading() && comments()} fallback={<CommentsSkeleton />}>
            {(current) => (
              <For
                each={threadIDs()}
                fallback={
                  <p class="mx-1 text-sm text-gray-400">
                    {filter() === "resolved" ? "No resolved comments." : "No comments yet."}
                  </p>
                }
              >
                {(threadID) => (
                  <Show when={threadsByID().get(threadID)}>
                    {(thread) => (
                      <div
                        class={clsx(
                          // Room for the hover shade, taken from the gap.
                          "-mb-1 flex flex-col gap-0.5 rounded-lg pb-1 transition-opacity",
                          // Below the sticky header.
                          hasResolved() ? "scroll-mt-18" : "scroll-mt-9",
                          shownActive() && shownActive() !== threadID && "opacity-60",
                          selectedThread() === threadID &&
                            "bg-gradient-to-r from-gray-500/10 to-transparent"
                        )}
                        data-comment-panel-thread={threadID}
                        // Title presses count as on the card, so a draft isn't dropped.
                        data-comment-thread-card={threadID}
                        onPointerDown={() => active() !== threadID && activate(threadID, true)}
                      >
                        <ThreadTitle
                          thread={thread()}
                          comments={current()}
                          block={blocks().get(threadID)}
                          opened={active() === threadID}
                          onReopen={() => {
                            setFilter("open");
                            activate(threadID, true);
                          }}
                        />
                        <ThreadCard
                          thread={thread()}
                          comments={current()}
                          focused={active() === threadID}
                          autofocus={activatedInPanel()}
                          draft={
                            threadID === draft()?.threadID ? (draft() ?? undefined) : undefined
                          }
                          onEscape={() => closeFromReply(threadID)}
                          hideHeader
                          onPanel
                          fluid
                        />
                      </div>
                    )}
                  </Show>
                )}
              </For>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
};

export { CommentsPanel };
