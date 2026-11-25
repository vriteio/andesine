import clsx from "clsx";
import { type Component, type ComponentProps, type JSX } from "solid-js";
import { Menu } from "@ark-ui/solid/menu";
import { Card } from "../card";
import { PresencePortal } from "../presence-portal";

interface DropdownDesktopMenuProps {
  cardProps?: Partial<ComponentProps<typeof Card>>;
  children: JSX.Element;
  opened: boolean;
  portal?: boolean;
}

const DropdownDesktopMenu: Component<DropdownDesktopMenuProps> = (props) => (
  <PresencePortal portal={props.portal}>
    <Menu.Positioner class="select-none">
      <Menu.Content
        asChild={(contentProps) => (
          <Card
            {...contentProps()}
            {...(props.cardProps || {})}
            style={{
              ...(props.cardProps?.style || {}),
              "transform-origin": "var(--transform-origin)"
            }}
            shade
            class={clsx(
              ":base-2: z-50 flex min-w-32 transform flex-col select-none rounded-[0.625rem] p-1 pointer-events-auto shadow-gray-900/8 transition duration-200 bg-white",
              props.opened
                ? ":base-2: visible translate-y-0 opacity-100"
                : ":base-2: invisible opacity-0 !shadow-none",
              props.cardProps?.class
            )}
          >
            <div class="min-w-0 flex-1 overflow-auto scrollbar-sm">{props.children}</div>
          </Card>
        )}
      />
    </Menu.Positioner>
  </PresencePortal>
);

export { DropdownDesktopMenu };
