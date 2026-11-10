import { type ExtensionArtifact } from "@andesine/contracts/extensions";
import { loadExtensionIconStyles } from "#web/lib/extensions";
import clsx from "clsx";
import { type Component, createEffect, createSignal, onCleanup, Show } from "solid-js";
import { ExtensionIconScope } from "./panel-view";

interface ExtensionIconSource {
  name: string;
  icon: string | null;
  iconStyles: ExtensionArtifact | null;
}
interface ExtensionIconProps extends ExtensionIconSource {
  class?: string;
}

const ExtensionIcon: Component<ExtensionIconProps> = (props) => {
  const [ready, setReady] = createSignal(false);

  // A browser-only effect, not a resource: icon CSS never holds up a page or a navigation.
  createEffect(() => {
    const { name, icon, iconStyles } = props;

    let current = true;

    setReady(false);
    onCleanup(() => (current = false));

    if (!icon || !iconStyles) return;

    loadExtensionIconStyles(name, iconStyles).then(
      () => current && setReady(true),
      () => {}
    );
  });

  return (
    <Show
      when={ready()}
      fallback={<div class={clsx("i-tabler:puzzle text-gray-400", props.class)} />}
    >
      <ExtensionIconScope extension={props.name}>
        <span class={clsx(props.icon, props.class)} />
      </ExtensionIconScope>
    </Show>
  );
};

export { ExtensionIcon };
export type { ExtensionIconSource };
