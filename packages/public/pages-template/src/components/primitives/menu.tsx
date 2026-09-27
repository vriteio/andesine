import { Menu as ArkMenu } from "@ark-ui/solid/menu";
import clsx from "clsx";
import { type Component, type JSX, For, Match, Show, Switch } from "solid-js";
import { Portal } from "solid-js/web";

interface MenuItem {
  type?: "item";
  value: string;
  label: string;
  icon?: string;
  href?: string;
  target?: string;
  onSelect?(): void;
}

interface MenuHeader {
  type: "header";
  label: string;
}

interface MenuSeparator {
  type: "separator";
}

interface MenuProps {
  items: MenuEntry[];
  /** Renders the trigger; spread the given props on the trigger element. */
  trigger(props: () => JSX.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
  class?: string;
}

interface MenuItemContentProps {
  item: MenuItem;
}

type MenuEntry = MenuItem | MenuHeader | MenuSeparator;

const itemClasses =
  "group relative flex w-full cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-sm text-gray-700 outline-none data-[highlighted]:bg-gray-100";

const MenuItemContent: Component<MenuItemContentProps> = (props) => (
  <>
    <Show when={props.item.icon}>
      <span
        aria-hidden="true"
        class={clsx("h-4.5 w-4.5 shrink-0 text-gray-500", props.item.icon)}
      />
    </Show>
    <span class="flex-1 truncate px-1 text-start">{props.item.label}</span>
  </>
);
const Menu: Component<MenuProps> = (props) => (
  <ArkMenu.Root
    positioning={{ placement: "bottom-end", offset: { mainAxis: 6 } }}
    onSelect={(details) => {
      const item = props.items.find(
        (entry): entry is MenuItem => "value" in entry && entry.value === details.value
      );

      item?.onSelect?.();
    }}
  >
    <ArkMenu.Trigger asChild={props.trigger} />
    <Portal>
      <ArkMenu.Positioner>
        <ArkMenu.Content
          class={clsx(
            // Like the app, menus show and hide without animation.
            "z-80 flex min-w-48 flex-col gap-0.5 rounded-[0.625rem] border border-gray-200 bg-white p-1 shadow-[0_0_12px_0px] shadow-black/15 outline-none",
            props.class
          )}
        >
          <For each={props.items}>
            {(entry) => (
              <Switch>
                <Match when={entry.type === "separator"}>
                  <ArkMenu.Separator class="my-0.5 h-px border-none bg-gray-200" />
                </Match>
                <Match when={entry.type === "header" && entry}>
                  {(header) => (
                    <span class="truncate px-1 py-0.5 text-xs text-gray-500">{header().label}</span>
                  )}
                </Match>
                <Match when={entry.type !== "header" && entry.type !== "separator" && entry}>
                  {(item) => (
                    <Show
                      when={item().href}
                      fallback={
                        <ArkMenu.Item value={item().value} class={itemClasses}>
                          <MenuItemContent item={item()} />
                        </ArkMenu.Item>
                      }
                    >
                      {(href) => (
                        <ArkMenu.Item
                          value={item().value}
                          asChild={(itemProps) => (
                            <a
                              {...itemProps({ class: itemClasses })}
                              href={href()}
                              target={item().target}
                            >
                              <MenuItemContent item={item()} />
                            </a>
                          )}
                        />
                      )}
                    </Show>
                  )}
                </Match>
              </Switch>
            )}
          </For>
        </ArkMenu.Content>
      </ArkMenu.Positioner>
    </Portal>
  </ArkMenu.Root>
);

export { Menu };
export type { MenuItem, MenuHeader, MenuSeparator, MenuEntry, MenuProps };
