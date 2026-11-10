import { MenuSection } from "#web/components/menu-section";
import { SettingsMenuItemRow } from "#web/pages/workspace/side-panel/settings-menu";
import { type Component, For } from "solid-js";
import { type HostComponentProps } from "./types";

/** Links in sections, as the app's settings menu; the selected one has its gradient. */
const ExtensionNavigation: Component<HostComponentProps<"Navigation">> = (props) => (
  <div class="flex flex-col gap-3">
    <For each={props.props.sections}>
      {(section) => (
        <MenuSection label={section.label}>
          <For each={section.items}>
            {(item) => (
              <SettingsMenuItemRow
                item={{
                  icon: item.icon ?? "i-lucide:circle",
                  label: item.label,
                  active: item.id === props.props.selected,
                  onClick: () => props.emit("onSelect", item.id)
                }}
              />
            )}
          </For>
        </MenuSection>
      )}
    </For>
  </div>
);
/** `Item` rows under a small header, as a `Navigation` section; what follows it is 12px away. */
const ExtensionItemGroup: Component<HostComponentProps<"ItemGroup">> = (props) => (
  <div class="[&+*]:mt-3">
    <MenuSection label={props.props.label}>{props.children}</MenuSection>
  </div>
);

export { ExtensionItemGroup, ExtensionNavigation };
