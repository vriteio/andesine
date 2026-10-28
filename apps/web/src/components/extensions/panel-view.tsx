import clsx from "clsx";
import { createRef, ScrollShadow } from "@andesine/components";
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
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);

  return (
    <div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-1">
      <div class="flex h-9 shrink-0 items-center">
        <h2 class="truncate text-2xl font-semibold">{props.item.panel.name}</h2>
      </div>
      <Show
        when={!unavailable()}
        fallback={<span class="text-sm text-gray-500">This panel is unavailable.</span>}
      >
        {/* Room for the view's shadows, e.g. a full-width button's, which the view's box clips. */}
        <div class="relative -mx-1 flex min-h-0 flex-1" hidden={!rendered()}>
          <div class="pointer-events-none absolute inset-y-0 left-0 right-3 overflow-hidden">
            <ScrollShadow color="contrast" scrollableContainerRef={scrollableContainerRef} />
          </div>
          <div
            ref={setScrollableContainerRef}
            class="min-h-0 w-full flex-1 scrollbar-contrast scrollbar-hover overflow-y-auto"
          >
            <ExtensionView host={host} viewID={viewID} class="w-full px-1 pb-2" />
          </div>
        </div>
      </Show>
    </div>
  );
};

export { ExtensionIconScope, ExtensionPanelView };
