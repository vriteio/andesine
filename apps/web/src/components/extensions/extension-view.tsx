import { FixedTooltips } from "@andesine/components";
import clsx from "clsx";
import {
  extensionComponentDefinitions,
  type ExtensionComponentDefinition,
  type ExtensionComponentName
} from "@andesine/contracts/extensions";
import { type ExtensionHost } from "#web/lib/extensions";
import { type Component, For, Match, Show, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { hostComponents } from "./host-components";

interface ExtensionNodeViewProps {
  host: ExtensionHost;
  id: number;
}
interface ExtensionViewProps {
  host: ExtensionHost;
  viewID: string;
  class?: string;
  /** Clips 12px outside the view's box, e.g. for soft shadows, in place of at its edge. */
  bleed?: boolean;
}

const definitions: Record<string, ExtensionComponentDefinition> = extensionComponentDefinitions;

// Calls a node's callback with the event's validated arguments.
const emitEvent = (host: ExtensionHost, id: number, event: string, args: unknown[]): void => {
  const node = host.tree.state.nodes[id];
  const callback = node?.callbacks[event];
  const result = definitions[node?.component]?.events[event]?.safeParse(args);

  if (callback && result?.success) host.invoke(callback, result.data as never);
};
const ExtensionNodeView: Component<ExtensionNodeViewProps> = (props) => {
  const node = () => props.host.tree.state.nodes[props.id];
  const emit = (event: string, ...args: unknown[]) => emitEvent(props.host, props.id, event, args);

  return (
    <Show when={node()}>
      {(node) => (
        <Switch>
          <Match when={node().component === "#text"}>{node().text}</Match>
          <Match when={node().component !== "#root"}>
            <Dynamic
              component={hostComponents[node().component as ExtensionComponentName]}
              id={props.id}
              props={node().props as never}
              emit={emit}
              hasEvent={(event: string) => node().callbacks[event] !== undefined}
              childNodes={() => node().children.map((id) => props.host.tree.state.nodes[id])}
              renderNode={(id: number) => <ExtensionNodeView host={props.host} id={id} />}
              getNode={(id: number) => props.host.tree.state.nodes[id]}
              emitNode={(id: number, event: string, ...args: unknown[]) => {
                emitEvent(props.host, id, event, args);
              }}
              hasRecentInteraction={props.host.hasRecentInteraction}
              sources={props.host.sources}
              extension={props.host.name}
            >
              <For each={node().children}>
                {(id) => <ExtensionNodeView host={props.host} id={id} />}
              </For>
            </Dynamic>
          </Match>
        </Switch>
      )}
    </Show>
  );
};
/**
 * Layout containment keeps the view's content, even fixed positioned, inside it; paint
 * containment, or a clip path for `bleed`, clips what it draws, so its tooltips are fixed.
 */
const ExtensionView: Component<ExtensionViewProps> = (props) => {
  const root = () => props.host.tree.state.nodes[props.host.tree.state.roots[props.viewID]];

  return (
    <div
      data-extension={props.host.name}
      class={clsx(
        "isolate min-w-0",
        props.bleed ? "[contain:layout] [clip-path:inset(-0.75rem)]" : "[contain:layout_paint]",
        props.class
      )}
    >
      <FixedTooltips>
        <Show when={root()}>
          {(root) => (
            <For each={root().children}>
              {(id) => <ExtensionNodeView host={props.host} id={id} />}
            </For>
          )}
        </Show>
      </FixedTooltips>
    </div>
  );
};

export { ExtensionView };
