import { IconButton } from "@andesine/components";
import {
  canToggleResolved,
  type EditorCommentPlace,
  type EditorComments,
  type EditorCommentSuggestion,
  type EditorCommentThread
} from "@andesine/editor";
import clsx from "clsx";
import { type Component, createSignal, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

interface ThreadTitleProps {
  thread: EditorCommentThread;
  comments: EditorComments;
  block?: EditorCommentPlace["block"];
  opened: boolean;
  onReopen(): void;
}
interface ThreadKind {
  label: string;
  icon: string | (() => JSX.Element);
}
interface ThreadOutcome {
  label: string;
  icon: string;
  class: string;
}

const getSuggestionLabel = ({ base, blocks, title }: EditorCommentSuggestion) => {
  if (title) return "Suggested title";

  if (!base.length) return "Suggested insertion";

  return blocks.length ? "Suggested edit" : "Suggested deletion";
};
const ThreadTitle: Component<ThreadTitleProps> = (props) => {
  const [resolving, setResolving] = createSignal(false);
  const kind = (): ThreadKind => {
    const { quote, suggestion } = props.thread;

    if (quote) return { label: `“${quote}”`, icon: "i-tabler:quote" };

    if (suggestion) return { label: getSuggestionLabel(suggestion), icon: "i-lucide:file-diff" };

    return props.block ?? { label: "Removed block", icon: "i-lucide:square-dashed" };
  };
  const iconClass = () => {
    const { icon } = kind();

    return typeof icon === "string" ? icon : null;
  };
  const iconComponent = () => {
    const { icon } = kind();

    return typeof icon === "string" ? undefined : icon;
  };
  // A suggestion's outcome shows on the right.
  const status = () => {
    if (props.thread.suggestion) return "";

    return { active: "", outdated: "Outdated", orphaned: "Removed" }[props.thread.status];
  };
  const outcome = (): ThreadOutcome | null => {
    const { resolved, suggestion } = props.thread;
    const gray = "text-gray-400";

    if (suggestion?.applied) {
      return { label: "Applied", icon: "i-lucide:check", class: "text-green-600" };
    }

    if (suggestion && props.thread.status === "outdated") {
      return { label: "Outdated", icon: "i-lucide:history", class: gray };
    }

    if (suggestion && props.thread.status === "orphaned") {
      return { label: "Removed", icon: "i-lucide:square-dashed", class: gray };
    }

    if (!resolved) return null;

    if (suggestion) return { label: "Rejected", icon: "i-lucide:x", class: "text-red-600" };

    return { label: "Resolved", icon: "i-lucide:check", class: gray };
  };
  const count = () => props.thread.comments.length;
  const canToggle = () => {
    return props.comments.canResolve && count() > 0 && canToggleResolved(props.thread);
  };
  const countLabel = () => {
    return count() === 0 ? "New comment" : count() === 1 ? "1 comment" : `${count()} comments`;
  };
  const resolve = async () => {
    const { reopen, resolve: close } = props.comments;

    setResolving(true);

    try {
      if (props.thread.resolved) {
        await reopen(props.thread.id);
        props.onReopen();
      } else {
        await close(props.thread.id);
      }
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      class="group relative flex flex-col gap-1 py-1 pl-0.75"
      data-comment-thread-title={props.thread.id}
    >
      {/* Guideline to the first comment. */}
      <div class="pointer-events-none absolute left-3.5 top-7 -bottom-1.5 w-px rounded-full bg-gray-300" />
      <div class="flex h-6 min-w-0 items-center gap-1">
        <div class="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400">
          <Show
            when={iconClass()}
            fallback={
              // Extension icons fill their box.
              <span class="flex h-5 w-5">
                <Dynamic component={iconComponent()} />
              </span>
            }
          >
            {(icon) => <div class={clsx(icon(), "h-5 w-5")} />}
          </Show>
        </div>
        <span
          class={clsx(
            "min-w-0 flex-1 text-base font-medium leading-tight truncate text-row",
            props.thread.status === "orphaned" ? "text-gray-400 line-through" : "text-gray-900"
          )}
        >
          {kind().label}
        </span>
        <Show when={outcome()}>
          {(current) => (
            <span
              class={clsx(
                "flex shrink-0 items-center gap-1 pr-1 text-sm font-medium",
                current().class,
                canToggle() && (props.opened ? "hidden" : "media-mouse:group-hover:hidden")
              )}
            >
              <span class={clsx(current().icon, "h-4 w-4")} />
              {current().label}
            </span>
          )}
        </Show>
        <Show when={canToggle()}>
          <div
            class={clsx(
              "-my-0.5 shrink-0",
              // Replaces the outcome on hover.
              !props.opened &&
                (outcome()
                  ? "hidden media-mouse:group-hover:block"
                  : "media-mouse:opacity-0 media-mouse:group-hover:opacity-100")
            )}
          >
            <IconButton
              class="flex-row-reverse pr-1"
              icon={props.thread.resolved ? "i-lucide:undo-2" : "i-lucide:check"}
              iconProps={{ class: "h-4 w-4" }}
              label={() => <span class="px-1">{props.thread.resolved ? "Reopen" : "Resolve"}</span>}
              variant="ghost"
              text="soft"
              loading={resolving()}
              onClick={() => resolve()}
            />
          </div>
        </Show>
      </div>
      <div class="-mt-1.5 flex min-w-0 items-center gap-1 pl-7 text-xs leading-4 text-gray-400">
        <Show when={status()}>
          {(label) => (
            <>
              <span>{label()}</span>
              <span class="h-3 w-px shrink-0 bg-gray-400 opacity-20" />
            </>
          )}
        </Show>
        <Show when={status()} fallback={<span>{countLabel()}</span>}>
          <span class="flex shrink-0 items-center gap-0.5">
            <span>{count()}</span>
            <span class="i-tabler:message h-3 w-3" />
          </span>
        </Show>
      </div>
    </div>
  );
};

export { ThreadTitle };
