import { IconButton } from "@andesine/components";
import type { EditorCommentPlace, EditorComments, EditorCommentThread } from "@andesine/editor";
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

const ThreadTitle: Component<ThreadTitleProps> = (props) => {
  const [resolving, setResolving] = createSignal(false);
  const kind = (): ThreadKind => {
    if (props.thread.quote) return { label: `“${props.thread.quote}”`, icon: "i-tabler:quote" };

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
  const status = () => {
    return { active: "", outdated: "Outdated", orphaned: "Removed" }[props.thread.status];
  };
  const count = () => props.thread.comments.length;
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
      class="group relative flex flex-col gap-1 py-1 pl-0.5"
      data-comment-thread-title={props.thread.id}
    >
      {/* Guideline to the first comment. */}
      <div class="pointer-events-none absolute left-3.25 top-7 -bottom-1.5 w-px rounded-full bg-gray-300" />
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
            "min-w-0 flex-1 text-base font-medium leading-tight line-clamp-1",
            props.thread.status === "orphaned" ? "text-gray-400 line-through" : "text-gray-900"
          )}
        >
          {kind().label}
        </span>
        <Show when={props.comments.canResolve && count() > 0}>
          <div
            class={clsx(
              "-my-0.5 shrink-0",
              !props.opened && "media-mouse:opacity-0 media-mouse:group-hover:opacity-100"
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
