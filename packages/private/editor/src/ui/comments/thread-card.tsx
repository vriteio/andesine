import clsx from "clsx";
import { type Component, createEffect, createSignal, For, type JSX, Show } from "solid-js";
import {
  createRef,
  DropdownArea,
  DropdownMenu,
  IconButton,
  type MenuItem,
  ScrollShadow
} from "@andesine/components";
import type { EditorComment, EditorComments, EditorCommentThread } from "#editor/client-types";
import { CommentEditor } from "./comment-editor";
import { CommentText } from "./comment-text";

interface AuthorIconProps {
  image?: string;
}
interface ThreadDraft {
  create(content: string): Promise<void>;
  cancel(): void;
}
interface ThreadCardProps {
  thread: EditorCommentThread;
  comments: EditorComments;
  /** Shows all comments and the reply field. */
  focused: boolean;
  draft?: ThreadDraft;
  header?: JSX.Element;
  hideHeader?: boolean;
  floating?: boolean;
  onPanel?: boolean;
  /** Scrolls long threads under the header. */
  scrollable?: boolean;
  autofocus?: boolean;
  onStep?(step: number): void;
  /** Without it, Escape only blurs the field. */
  onEscape?(): void;
  fluid?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  ref?(element: HTMLElement): void;
}
interface CommentCardProps {
  comment: EditorComment;
  comments: EditorComments;
  /** Extends the guideline to the next comment. */
  continues: boolean;
  /** Its deletion deletes the thread. */
  first: boolean;
  onResolve?(): void;
  floating?: boolean;
  onPanel?: boolean;
}

const THREAD_CARD_WIDTH = 288;
// The header (h-7) and its gap.
const THREAD_HEADER_SPACE = 28 + 2;
// To the first author row's middle, which aligns with the commented line.
const FIRST_COMMENT_CENTER = THREAD_HEADER_SPACE + 4 + 12;
// Marks the menu, which is outside the card, as part of the thread.
const MENU_CARD_PROPS = { "class": "min-w-48", "data-comment-menu": "" };

const AuthorIcon: Component<AuthorIconProps> = (props) => {
  return (
    <div class="flex h-6 w-6 shrink-0 items-center justify-center">
      <Show
        when={props.image}
        fallback={<div class="i-lucide:circle-user h-5 w-5 text-gray-400" />}
      >
        {(image) => <img src={image()} alt="" class="h-5 w-5 rounded-md object-cover" />}
      </Show>
    </div>
  );
};
const CommentCard: Component<CommentCardProps> = (props) => {
  const [menuOpened, setMenuOpened] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const options = (): MenuItem[][] => {
    const items: MenuItem[] = [];

    if (props.comments.canResolve && props.onResolve) {
      items.push({
        label: "Resolve thread",
        icon: "i-lucide:check",
        onClick: () => props.onResolve?.()
      });
    }

    if (props.comment.editable) {
      items.push({
        label: "Edit comment",
        icon: "i-lucide:pencil",
        onClick: () => setEditing(true)
      });
    }

    if (props.comment.deletable) {
      items.push({
        label: props.first ? "Delete thread" : "Delete comment",
        icon: "i-lucide:trash",
        color: "danger",
        onClick: () => remove()
      });
    }

    return items.length ? [items] : [];
  };
  const remove = async () => {
    setDeleting(true);

    try {
      await props.comments.remove(props.comment.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DropdownArea>
      <div
        class={clsx(
          "group relative flex flex-col gap-1 py-1 pl-0.5 pr-0.5 rounded-lg",
          !editing() &&
            "media-mouse:hover:bg-gradient-to-r media-mouse:hover:from-gray-500/10 media-mouse:hover:to-transparent",
          menuOpened() && "bg-gradient-to-r from-gray-500/10 to-transparent",
          deleting() && "opacity-50"
        )}
      >
        <div
          class={clsx(
            "pointer-events-none absolute left-3.25 top-7 w-px rounded-full bg-gray-300",
            props.continues ? "-bottom-1.5" : "bottom-1"
          )}
        />
        <div class="flex h-6 items-center gap-1 min-w-0">
          <AuthorIcon image={props.comment.authorImage} />
          <span class="min-w-0 flex-1 text-base font-medium leading-tight text-gray-900 line-clamp-1">
            {props.comment.authorName}
          </span>
          <Show when={options().length > 0}>
            <DropdownMenu
              title="Comment"
              cardProps={MENU_CARD_PROPS}
              items={options()}
              opened={menuOpened()}
              setOpened={setMenuOpened}
              trigger={() => (
                <div
                  class={
                    !menuOpened()
                      ? "shrink-0 opacity-20 media-mouse:hidden media-mouse:group-hover:flex media-mouse:group-hover:opacity-100"
                      : "shrink-0"
                  }
                >
                  <IconButton icon="i-lucide:ellipsis-vertical" variant="ghost" size="xs" />
                </div>
              )}
            />
          </Show>
        </div>
        <span class="-mt-1.5 pl-7 text-xs leading-4 text-gray-400">
          {props.comments.formatTime(props.comment.createdAt)}
        </span>
        <Show
          when={editing()}
          fallback={<CommentText class="pl-7" content={props.comment.content} />}
        >
          <div class="pl-7">
            <CommentEditor
              gray={props.floating}
              onPanel={props.onPanel}
              placeholder="Edit the comment..."
              value={props.comment.content}
              onCancel={() => setEditing(false)}
              onSubmit={async (content) => {
                await props.comments.update(props.comment.id, content);
                setEditing(false);
              }}
            />
          </div>
        </Show>
      </div>
    </DropdownArea>
  );
};
const ThreadCard: Component<ThreadCardProps> = (props) => {
  const [resolving, setResolving] = createSignal(false);
  const [list, setList] = createRef<HTMLElement | null>(null);
  const count = () => props.thread.comments.length;
  const hiddenCount = () => (props.focused ? 0 : Math.max(count() - 2, 0));
  const shownComments = () => {
    const { comments } = props.thread;

    return hiddenCount() ? [comments[0], comments[comments.length - 1]] : comments;
  };
  const canReply = () => props.comments.canComment && !props.thread.resolved;
  const resolve = async () => {
    setResolving(true);

    try {
      await (props.thread.resolved ? props.comments.reopen : props.comments.resolve)(
        props.thread.id
      );
    } finally {
      setResolving(false);
    }
  };

  // Starts at the end, by the reply field.
  createEffect(() => {
    const element = list();

    if (props.scrollable && element) {
      requestAnimationFrame(() => element.scrollTo({ top: element.scrollHeight }));
    }
  });

  return (
    <div
      ref={props.ref}
      class={clsx("flex flex-col gap-0.5 not-prose", props.class)}
      style={{ ...props.style, width: props.fluid ? undefined : `${THREAD_CARD_WIDTH}px` }}
      data-comment-thread-card={props.thread.id}
      data-menu
    >
      {/* Hidden, not removed, so threads don't move when focused. */}
      <Show when={!props.hideHeader}>
        <div class={clsx("flex items-center h-7", !props.focused && "invisible")}>
          {props.header ?? (
            <Show when={count()}>
              <span class="pl-2 text-sm text-gray-400">
                <span class="font-mono">{count()}</span>
                {count() === 1 ? " comment" : " comments"}
              </span>
            </Show>
          )}
          <Show when={props.comments.canResolve && !props.draft}>
            <IconButton
              class="ml-auto flex-row-reverse pr-1"
              icon={props.thread.resolved ? "i-lucide:undo-2" : "i-lucide:check"}
              iconProps={{ class: "h-4 w-4" }}
              label={() => <span class="px-1">{props.thread.resolved ? "Reopen" : "Resolve"}</span>}
              variant="ghost"
              text="soft"
              loading={resolving()}
              onClick={() => resolve()}
            />
          </Show>
        </div>
      </Show>
      <div class="relative">
        <Show when={props.scrollable}>
          <ScrollShadow color={props.floating ? "white" : "base"} scrollableContainerRef={list} />
        </Show>
        <div
          ref={setList}
          class={clsx(
            "flex flex-col gap-0.5",
            props.scrollable &&
              // Into the padding, for the field's shadow; the track ends above the corner.
              "overflow-y-auto overscroll-contain -mx-1 -mb-1 px-1 pb-2 scrollbar-sm scrollbar-hover [&::-webkit-scrollbar-track]:!mb-4",
            props.scrollable &&
              (props.floating ? "max-h-[60vh] scrollbar-white" : "max-h-[70vh] scrollbar-base")
          )}
        >
          <For each={shownComments()}>
            {(comment, index) => (
              <>
                <CommentCard
                  comment={comment}
                  comments={props.comments}
                  floating={props.floating}
                  onPanel={props.onPanel}
                  onResolve={props.thread.resolved ? undefined : () => resolve()}
                  continues={index() < shownComments().length - 1 || (props.focused && canReply())}
                  first={index() === 0}
                />
                <Show when={index() === 0 && hiddenCount()}>
                  {/* No handler: a press on the thread focuses it. */}
                  <button
                    type="button"
                    class="relative flex items-center gap-1 py-1 pl-0.5 rounded-lg text-sm font-medium text-gray-500 media-mouse:hover:bg-gradient-to-r media-mouse:hover:from-gray-500/10 media-mouse:hover:to-transparent"
                  >
                    <div class="pointer-events-none absolute left-3.25 top-7 -bottom-1.5 w-px rounded-full bg-gray-300" />
                    <div class="flex h-6 w-6 shrink-0 items-center justify-center">
                      <div class="i-lucide:chevrons-up-down h-5 w-5 text-gray-400" />
                    </div>
                    <span class="shrink-0">
                      {hiddenCount() === 1 ? "Show 1 comment" : `Show ${hiddenCount()} comments`}
                    </span>
                  </button>
                </Show>
              </>
            )}
          </For>
          <Show when={props.focused && canReply()}>
            <div
              class={clsx(
                "relative flex flex-col gap-1 pt-1 pl-0.5 pr-0.5",
                !props.scrollable && "pb-1"
              )}
            >
              <div
                class={clsx(
                  "pointer-events-none absolute left-3.25 top-7 w-px rounded-full bg-gray-300",
                  props.scrollable ? "bottom-0" : "bottom-1"
                )}
              />
              <div class="flex h-6 items-center gap-1 min-w-0">
                <AuthorIcon image={props.comments.authorImage} />
                <span class="min-w-0 flex-1 text-base font-medium leading-tight text-gray-900 line-clamp-1">
                  {props.comments.authorName}
                </span>
              </div>
              <div class="pl-7">
                <CommentEditor
                  gray={props.floating}
                  onPanel={props.onPanel}
                  placeholder={props.draft ? "Add a comment..." : "Reply..."}
                  autofocus={props.autofocus}
                  onCancel={props.draft?.cancel ?? props.onEscape}
                  onStep={props.onStep}
                  onSubmit={(content) => {
                    return props.draft
                      ? props.draft.create(content)
                      : props.comments.reply(props.thread.id, content);
                  }}
                />
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export { FIRST_COMMENT_CENTER, THREAD_CARD_WIDTH, THREAD_HEADER_SPACE, ThreadCard };
