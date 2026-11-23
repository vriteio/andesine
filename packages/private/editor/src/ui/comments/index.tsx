import type { Editor, EditorEvents } from "@tiptap/core";
import {
  type Accessor,
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  untrack
} from "solid-js";
import { Card, IconButton } from "@andesine/components";
import clsx from "clsx";
import type { EditorComments, EditorCommentThread, ElementViews } from "#editor/client-types";
import {
  type CommentTargetDraft,
  DRAFT_THREAD_ID,
  changesComments,
  getCommentDraft,
  updateComments
} from "#editor/extensions/comments";
import { getEditorScrollContainer } from "#editor/ui/block-control-targeting";
import { BLOCK_CONTROL_SIZE, EDITOR_MENU_Z_INDEX } from "#editor/ui/constants";
import { FIRST_COMMENT_CENTER, THREAD_HEADER_SPACE, ThreadCard } from "./thread-card";
import {
  type AnchorGroup,
  type CommentLayout,
  GUTTER_SPACE,
  INLINE_INSET,
  measureComments,
  placeThreads,
  refreshReach
} from "./layout";
import { scrollToThread, syncCommentsPanel } from "./panel";
import { ThreadNavigation } from "./thread-navigation";

interface CommentCardsProps {
  editor: Editor;
  comments: EditorComments;
  elementViews?: ElementViews;
}

// The popover's padding (p-1) and border.
const POPOVER_INSET = 4 + 1;

/** The thread of the chip under the pointer; a ::before, so hit-tested by its box. */
const getChipThread = (event: PointerEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const block = target?.closest("[data-suggestion-thread]");

  if (!block) return null;

  const chip = getComputedStyle(block, "::before");
  const rect = block.getBoundingClientRect();
  const right = rect.right - parseFloat(chip.right);
  const isInRow = Math.abs(event.clientY - rect.top) <= parseFloat(chip.height) / 2;
  const isOnChip =
    isInRow && event.clientX <= right && event.clientX >= right - parseFloat(chip.width);

  return isOnChip ? block.getAttribute("data-suggestion-thread") : null;
};

const CommentCards: Component<CommentCardsProps> = (props) => {
  const [layout, setLayout] = createSignal<CommentLayout | null>(null);
  const [heights, setHeights] = createSignal<Record<string, number>>({});
  // Place the cards, so opening one doesn't move it.
  const [closedHeights, setClosedHeights] = createSignal<Record<string, number>>({});
  const [openGroup, setOpenGroup] = createSignal<string | null>(null);
  const [threadIndex, setThreadIndex] = createSignal(0);
  const [focusedThread, setFocusedThread] = createSignal<string | null>(null);
  // From a highlight, so it doesn't take the focus from the text.
  const [focusedFromText, setFocusedFromText] = createSignal(false);
  const [draft, setDraft] = createSignal<CommentTargetDraft | null>(null);
  const threads = () => props.comments.threads.filter(({ resolved }) => !resolved);
  const panel = () => props.comments.panel;
  const shownLayout = createMemo((): CommentLayout | null => {
    const current = layout();

    return current && panel() ? { ...current, anchors: [] } : current;
  });
  const placement = createMemo(() => {
    return placeThreads(shownLayout(), heights(), closedHeights(), focusedThread());
  });
  const cardTops = () => placement().tops;
  const groups = () => placement().buttons;
  // Keyed, so a button isn't replaced between a press and its click.
  const groupKeys = createMemo(() => groups().map(({ key }) => key));
  const groupsByKey = createMemo(() => new Map(groups().map((group) => [group.key, group])));
  const openedGroup = () => groupsByKey().get(openGroup() ?? "") ?? null;
  const buttonGroupOf = (threadID: string | null) => {
    return groups().find(({ threads }) => threads.some(({ id }) => id === threadID));
  };
  // A focused thread with no card or button, e.g. in a table.
  const floatingGroup = createMemo((): AnchorGroup | null => {
    const anchor = shownLayout()?.anchors.find(({ thread }) => {
      const hasPlace = thread.id in cardTops() || Boolean(buttonGroupOf(thread.id));

      return thread.id === focusedThread() && !hasPlace;
    });

    if (!anchor) return null;

    return {
      key: anchor.thread.id,
      center: anchor.center,
      threads: [anchor.thread],
      count: anchor.thread.comments.length
    };
  });
  const popoverThreadID = (group: AnchorGroup) => {
    return group.threads[threadIndex() % group.threads.length]?.id ?? "";
  };
  const hasPopoverHeader = (group: AnchorGroup) => {
    return group.threads.length > 1 || popoverThreadID(group) !== DRAFT_THREAD_ID;
  };
  const stepThread = (group: AnchorGroup, step: number) => {
    const count = group.threads.length;

    setThreadIndex((index) => (((index + step) % count) + count) % count);
  };

  // Keyed, so cards keep their state, e.g. a reply's draft.
  const anchorIDs = createMemo(() => {
    const anchors = shownLayout()?.anchors ?? [];

    return anchors.map(({ thread }) => thread.id).filter((threadID) => threadID in cardTops());
  });
  const threadsByID = createMemo(() => {
    const draftThread: EditorCommentThread = {
      id: DRAFT_THREAD_ID,
      anchor: null,
      blockID: null,
      resolved: false,
      quote: null,
      status: "active",
      suggestion: null,
      comments: []
    };

    return new Map(
      [...threads(), ...(draft() ? [draftThread] : [])].map((thread) => [thread.id, thread])
    );
  });
  const cancelDraft = () => {
    if (untrack(draft) && !props.editor.isDestroyed) updateComments(props.editor, { draft: null });
  };
  const draftActions = {
    create: async (content: string) => {
      const target = draft()?.target;

      if (!target) return;

      await props.comments.create({ ...target, content });
      cancelDraft();
    },
    cancel: cancelDraft
  };
  const observeHeight = (threadID: string, element: HTMLElement) => {
    const observer = new ResizeObserver(() => {
      const height = element.offsetHeight;

      setHeights((current) => ({ ...current, [threadID]: height }));

      if (untrack(focusedThread) !== threadID) {
        setClosedHeights((current) => ({ ...current, [threadID]: height }));
      }
    });

    observer.observe(element);
    onCleanup(() => observer.disconnect());
  };

  createEffect(() => {
    const { editor } = props;
    const scrollContainer = getEditorScrollContainer(editor);
    const resizeObserver = new ResizeObserver(() => update());

    let frame = 0;
    let scrollFrame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setDraft(getCommentDraft(editor.state));
        setLayout(measureComments(props.editor, untrack(threadsByID)));
      });
    };
    // Block scrolling changes only the reach.
    const refreshOnScroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        setLayout((current) => current && refreshReach(current));
      });
    };
    const updateOnChange = ({ transaction }: EditorEvents["transaction"]) => {
      if (changesComments(transaction)) update();
    };

    // `editor.view` is gone once the editor is destroyed.
    const editorDOM = editor.view.dom;

    // Measures again when the threads change.
    threads();
    update();
    editor.on("transaction", updateOnChange);
    editorDOM.addEventListener("scroll", refreshOnScroll, true);
    resizeObserver.observe(editorDOM);
    if (scrollContainer) resizeObserver.observe(scrollContainer);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      editor.off("transaction", updateOnChange);
      editorDOM.removeEventListener("scroll", refreshOnScroll, true);
      resizeObserver.disconnect();
    });
  });
  createEffect(() => {
    const focus = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest("[data-comment-thread-card]");
      // Text only, as blocks are clicked to edit them.
      const highlight = target?.closest("[data-comment-text][data-comment-thread]");
      const chipID = getChipThread(event);
      const highlightID = highlight?.getAttribute("data-comment-thread") ?? chipID;
      const threadID = card?.getAttribute("data-comment-thread-card") ?? highlightID;

      // Menus are outside their card.
      if (target?.closest("[data-comment-menu]")) return;

      // Keeps focus out of the chip's block, e.g. a code editor.
      if (chipID) event.preventDefault();

      // Leaving the draft drops it.
      if (threadID !== DRAFT_THREAD_ID) cancelDraft();

      if (highlightID) panel()?.activate(highlightID);

      setFocusedFromText(!card && Boolean(highlightID));
      setFocusedThread(threadID);
    };

    document.addEventListener("pointerdown", focus);
    onCleanup(() => document.removeEventListener("pointerdown", focus));
  });
  onMount(() => {
    const link = (threadID: string | null, linked: boolean) => {
      if (!threadID) return;

      const selector = `[data-comment-thread-card="${CSS.escape(threadID)}"]`;

      for (const element of document.querySelectorAll(selector)) {
        // An attribute, as the card sets its classes again as it moves.
        element.toggleAttribute("data-comment-linked", linked);
      }
    };
    // Links hovered content and its card, both ways.
    const hover = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const range = target?.closest("[data-comment-text][data-comment-thread]");
      const card = target?.closest("[data-comment-thread-card]");
      const threadID = range?.getAttribute("data-comment-thread") ?? getChipThread(event);
      const cardID = card?.getAttribute("data-comment-thread-card") ?? null;

      if (threadID !== hovered) link(hovered, false);

      // On every move, as a redrawn card loses the attribute.
      link(threadID, true);
      hovered = threadID;

      if (cardID !== hoveredCard && !props.editor.isDestroyed) {
        hoveredCard = cardID;
        updateComments(props.editor, { hovered: cardID });
      }
    };

    let hovered: string | null = null;
    let hoveredCard: string | null = null;

    // Not pointerover, as the chip is part of its block.
    document.addEventListener("pointermove", hover);
    onCleanup(() => {
      document.removeEventListener("pointermove", hover);
      link(hovered, false);
    });
  });
  const activeThread = createMemo(() => {
    const opened = openedGroup();
    // The panel decides it while open.
    const current = panel();
    const threadID = current
      ? current.active
      : (focusedThread() ?? (opened ? popoverThreadID(opened) : null));

    return threadID === DRAFT_THREAD_ID ? null : threadID;
  });

  createEffect(
    on(activeThread, (active) => {
      if (props.editor.isDestroyed) return;

      updateComments(props.editor, { active });

      // The panel scrolls to its own.
      if (!panel()) scrollToThread(props.editor, layout(), active);
    })
  );
  syncCommentsPanel({
    editor: props.editor,
    panel,
    layout,
    threads: () => props.comments.threads,
    elementViews: props.elementViews
  });
  createEffect(() => {
    const current = draft();

    panel()?.setDraft(
      current && {
        threadID: DRAFT_THREAD_ID,
        quote: current.target.quote ?? null,
        ...draftActions
      }
    );
  });
  onCleanup(() => untrack(panel)?.setDraft(null));
  createEffect(
    on(draft, (current) => {
      if (!current) return;

      setFocusedFromText(false);
      setFocusedThread(DRAFT_THREAD_ID);
    })
  );
  createEffect(() => {
    const threadID = focusedThread();
    const group = buttonGroupOf(threadID);

    if (!group) return;

    setOpenGroup(group.key);
    setThreadIndex(group.threads.findIndex(({ id }) => id === threadID));
  });
  createEffect(() => {
    if (!openGroup()) return;

    const close = (event: Event) => {
      const isInside =
        event.target instanceof Element &&
        event.target.closest("[data-comment-popover], [data-comment-button], [data-comment-menu]");

      if (event instanceof KeyboardEvent ? event.key === "Escape" : !isInside) {
        setOpenGroup(null);
        setFocusedThread(null);
        cancelDraft();
      }
    };

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    onCleanup(() => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    });
  });

  const renderPopover = (group: Accessor<AnchorGroup>) => {
    // A boolean, so the header isn't recreated for each group object.
    const hasNavigation = createMemo(() => group().threads.length > 1);

    return (
      <Card
        class="absolute right-3 scroll-my-4 p-1 overflow-hidden bg-white pointer-events-auto"
        style={{
          "z-index": EDITOR_MENU_Z_INDEX.blockMenu + 2,
          "top": `${group().center - FIRST_COMMENT_CENTER + (hasPopoverHeader(group()) ? 0 : THREAD_HEADER_SPACE) - POPOVER_INSET}px`
        }}
        shade
        data-comment-popover
        // Not from a highlight, as that would scroll the text.
        ref={(element) => {
          if (untrack(focusedFromText)) return;

          requestAnimationFrame(() => element.scrollIntoView({ block: "nearest" }));
        }}
      >
        <For each={[popoverThreadID(group())]}>
          {(threadID) => (
            <Show when={threadsByID().get(threadID)}>
              {(thread) => (
                <ThreadCard
                  thread={thread()}
                  comments={props.comments}
                  focused
                  floating
                  scrollable
                  autofocus={!untrack(focusedFromText)}
                  hideHeader={!hasPopoverHeader(group())}
                  draft={thread().id === DRAFT_THREAD_ID ? draftActions : undefined}
                  onStep={
                    group().threads.length > 1 ? (step) => stepThread(group(), step) : undefined
                  }
                  header={
                    hasNavigation() ? (
                      <ThreadNavigation
                        index={threadIndex() % group().threads.length}
                        count={group().threads.length}
                        onStep={(step) => stepThread(group(), step)}
                      />
                    ) : undefined
                  }
                />
              )}
            </Show>
          )}
        </For>
      </Card>
    );
  };

  return (
    <Show when={layout()}>
      {(current) => (
        <>
          <For each={groupKeys()}>
            {(key) => (
              <Show when={groupsByKey().get(key)}>
                {(group) => (
                  <div
                    class="absolute pointer-events-auto"
                    style={{
                      "z-index": EDITOR_MENU_Z_INDEX.blockMenu + 1,
                      "left": `${current().controlsLeft}px`,
                      "top": `${group().center - BLOCK_CONTROL_SIZE / 2}px`
                    }}
                    data-comment-button
                    data-menu
                  >
                    <IconButton
                      icon="i-tabler:message"
                      aria-label={`${group().count} comments`}
                      onClick={() => {
                        setThreadIndex(0);
                        setOpenGroup(openGroup() === key ? null : key);
                      }}
                    />
                    <span class="pointer-events-none absolute bottom-0.5 right-0.5 rounded-lg bg-white text-[0.625rem] font-semibold leading-none tabular-nums text-gray-900">
                      {group().count > 9 ? "9+" : group().count}
                    </span>
                  </div>
                )}
              </Show>
            )}
          </For>
          <Show when={openedGroup()}>{renderPopover}</Show>
          <Show when={floatingGroup()}>{renderPopover}</Show>
          <Show when={current().inline}>
            <For each={anchorIDs()}>
              {(threadID) => (
                <Show when={threadsByID().get(threadID)}>
                  {(thread) => (
                    // Opaque, so text under it doesn't show through.
                    <ThreadCard
                      class={clsx(
                        "absolute box-content p-1 overflow-hidden rounded-2xl bg-gray-50 pointer-events-auto transition-[top,opacity]",
                        focusedThread() && focusedThread() !== threadID && "opacity-60"
                      )}
                      style={{
                        left: `${current().controlsLeft + BLOCK_CONTROL_SIZE + GUTTER_SPACE - INLINE_INSET}px`,
                        top: `${(cardTops()[threadID] ?? 0) - INLINE_INSET}px`
                      }}
                      thread={thread()}
                      comments={props.comments}
                      focused={focusedThread() === threadID}
                      scrollable={focusedThread() === threadID}
                      autofocus={!focusedFromText()}
                      draft={threadID === DRAFT_THREAD_ID ? draftActions : undefined}
                      ref={(element) => observeHeight(threadID, element)}
                    />
                  )}
                </Show>
              )}
            </For>
          </Show>
        </>
      )}
    </Show>
  );
};

export { CommentCards };
