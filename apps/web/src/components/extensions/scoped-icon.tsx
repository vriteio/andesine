import clsx from "clsx";
import { type Component } from "solid-js";
import { ExtensionIconScope } from "./panel-view";

interface ScopedIconProps {
  extension: string;
  icon: string;
}

/** A manifest icon of a running extension; it fills its container, e.g. a menu's icon box. */
const ScopedIcon: Component<ScopedIconProps> = (props) => (
  <ExtensionIconScope extension={props.extension} class="h-full w-full">
    <span class={clsx("h-full w-full", props.icon)} />
  </ExtensionIconScope>
);

export { ScopedIcon };
