import { IconPicker } from "@andesine/components";
import { type Component } from "solid-js";
import { ICON_PICKER_SETS, loadIconSet } from "#web/lib/extensions/icon-masks";
import { type HostComponentProps } from "./types";

/** The icons of the app's bundled Iconify sets, loaded when the dropdown opens. */
const ExtensionIconPicker: Component<HostComponentProps<"IconPicker">> = (props) => {
  // The extension's sets, in its order.
  const sets = () => {
    return (props.props.sets ?? ["lucide"]).flatMap((prefix) => {
      return ICON_PICKER_SETS.filter((set) => set.prefix === prefix);
    });
  };

  return (
    <IconPicker
      value={props.props.value || undefined}
      sets={sets()}
      loadSet={loadIconSet}
      placeholder={props.props.placeholder}
      disabled={props.props.disabled}
      clearable={props.props.clearable}
      compact={props.props.compact}
      setValue={(value) => props.emit("onChange", value)}
    />
  );
};

export { ExtensionIconPicker };
