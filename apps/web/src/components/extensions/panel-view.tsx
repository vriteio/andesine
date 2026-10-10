import clsx from "clsx";
import { Skeleton } from "@andesine/components";
import { type RunningExtensionPanel } from "#web/lib/extensions";
import {
  type Component,
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show
} from "solid-js";
import { ExtensionView } from "./extension-view";

interface ExtensionPanelViewProps {
  item: RunningExtensionPanel;
  /** Context IDs only: the current collection and entry for right panels. */
  context: Record<string, string>;
}
interface ExtensionIconScopeProps {
  extension: string;
  class?: string;
  children: JSX.Element;
}

type ViewProps = NonNullable<
  Parameters<RunningExtensionPanel["extension"]["host"]["createView"]>[1]
>;

/** Wraps host UI that shows a manifest icon; the icon CSS applies only inside it. */
const ExtensionIconScope: Component<ExtensionIconScopeProps> = (props) => (
  <span
    data-extension-icon={props.extension}
    class={clsx("isolate inline-flex [contain:layout_paint]", props.class)}
  >
    {props.children}
  </span>
);
const ExtensionPanelView: Component<ExtensionPanelViewProps> = (props) => {
  const { host } = props.item.extension;
  const [failed, setFailed] = createSignal(false);
  const viewID = host.createView(props.item.panel.entry, props.context as ViewProps);
  const rendered = () => {
    const root = host.tree.state.roots[viewID];

    return root !== undefined && host.tree.state.nodes[root]?.children.length > 0;
  };
  const unavailable = () => failed() || props.item.extension.status() === "failed";

  onCleanup(props.item.extension.onViewError(viewID, () => setFailed(true)));
  onCleanup(() => host.disposeView(viewID));
  // Sends the context only when its IDs change, not on every recomputation.
  createEffect(
    on(
      () => JSON.stringify(props.context),
      () => host.updateView(viewID, props.context as ViewProps),
      { defer: true }
    )
  );

  return (
    <div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-1">
      <div class="flex h-9 shrink-0 items-center">
        <h2 class="truncate text-2xl font-semibold">{props.item.panel.name}</h2>
      </div>
      <Show
        when={!unavailable()}
        fallback={<span class="text-sm text-gray-500">This panel is unavailable.</span>}
      >
        <Show when={!rendered()}>
          <Skeleton class={["h-6 w-full rounded-lg", "h-6 w-2/3 rounded-lg"]} />
        </Show>
        <div class="min-h-0 flex-1 overflow-y-auto scrollbar-sm" hidden={!rendered()}>
          <ExtensionView host={host} viewID={viewID} />
        </div>
      </Show>
    </div>
  );
};

export { ExtensionIconScope, ExtensionPanelView };
