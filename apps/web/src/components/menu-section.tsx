import { type JSX, type ParentComponent, Show } from "solid-js";

interface MenuSectionProps {
  label?: JSX.Element;
}

/** Menu rows under a small header, as in the settings menu and side panels; rows are 2px apart. */
const MenuSection: ParentComponent<MenuSectionProps> = (props) => (
  <div class="flex min-w-0 flex-col">
    <Show when={props.label}>
      <span class="ml-1 text-xs leading-normal text-gray-400">{props.label}</span>
    </Show>
    <div class="flex flex-col gap-0.5">{props.children}</div>
  </div>
);

export { MenuSection };
