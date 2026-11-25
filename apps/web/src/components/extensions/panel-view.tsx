import clsx from "clsx";
import { PanelLayout } from "#web/components/panel-layout";
import { type RunningExtensionPanel } from "#web/lib/extensions";
import { type Component, type JSX, Show } from "solid-js";
import { ExtensionView } from "./extension-view";
import { useExtensionView } from "./use-extension-view";

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
  const { viewID, rendered, unavailable } = useExtensionView(
    props.item.extension,
    props.item.panel.view,
    () => props.context
  );

  return (
    <PanelLayout title={props.item.panel.name} class="flex-1">
      <Show
        when={!unavailable()}
        fallback={<span class="text-sm text-gray-500">This panel is unavailable.</span>}
      >
        <div class="w-full" hidden={!rendered()}>
          <ExtensionView host={host} viewID={viewID} class="w-full pb-2" />
        </div>
      </Show>
    </PanelLayout>
  );
};

export { ExtensionIconScope, ExtensionPanelView };
