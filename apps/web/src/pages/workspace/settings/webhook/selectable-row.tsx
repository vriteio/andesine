import { Checkbox } from "@andesine/components";
import clsx from "clsx";
import { children, type Component, type JSX, Show } from "solid-js";

interface SelectableRowProps {
  checked: boolean | "indeterminate";
  description: JSX.Element;
  disabled: boolean;
  label: JSX.Element;
  leading?: JSX.Element;
  onClick?(): void;
  setChecked(checked: boolean): void;
}

// A settings row whose label uses the available width. The leading icon and the
// checkbox align with the title. Without `onClick`, clicking the row toggles the checkbox.
const SelectableRow: Component<SelectableRowProps> = (props) => {
  // Resolve the leading element once: reading a JSX prop again would create new nodes and
  // break hydration.
  const leading = children(() => props.leading);
  const interactive = () => Boolean(props.onClick) || !props.disabled;
  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
    } else if (!props.disabled) {
      props.setChecked(props.checked !== true);
    }
  };

  return (
    <div
      class={clsx(
        "group/setting relative -mx-2 flex items-start gap-1.5 px-2 py-2",
        interactive() && "cursor-pointer"
      )}
      onClick={handleClick}
    >
      <div class="absolute left-0 top-0 -z-1 h-full w-full rounded-lg from-gray-500/5 to-transparent media-mouse:group-hover/setting:bg-gradient-to-r" />
      <Show when={leading()}>
        <div class="flex h-5 shrink-0 items-center">{leading()}</div>
      </Show>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="font-medium leading-tight">{props.label}</span>
        <span class="max-w-4/5 text-sm leading-tight text-gray-400">{props.description}</span>
      </div>
      <div class="flex h-5 shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          size="small"
          checked={props.checked}
          disabled={props.disabled}
          setChecked={props.setChecked}
        />
      </div>
    </div>
  );
};

export { SelectableRow };
