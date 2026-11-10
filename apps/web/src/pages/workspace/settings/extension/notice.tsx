import clsx from "clsx";
import { children, type Component, type JSX, Show } from "solid-js";

interface NoticeProps {
  icon: string;
  children: JSX.Element;
  actions?: JSX.Element;
}

/** Something that needs a manager, shown under the extension's header. */
const Notice: Component<NoticeProps> = (props) => {
  // Resolved once, since reading a JSX prop again creates its elements again.
  const actions = children(() => props.actions);

  return (
    <div class="flex flex-col gap-2 rounded-xl bg-gray-100 p-1 pl-2 text-sm md:flex-row md:items-center">
      <div class={clsx("h-5 w-5 shrink-0", props.icon)} />
      <div class="min-w-0 flex-1">{props.children}</div>
      <Show when={actions()}>
        <div class="flex shrink-0 justify-end gap-1">{actions()}</div>
      </Show>
    </div>
  );
};

export { Notice };
