import { TreeItem, useTree } from "#web/components/tree";
import { type Card, DropdownArea, DropdownMenu, IconButton } from "@andesine/components";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal
} from "solid-js";
import clsx from "clsx";
import { formatDate, formatRelativeTime } from "#web/lib/primitives";

interface ConnectedAppItemProps {
  clientID: string;
  name: string;
  type: "cli" | "mcp";
  workspaces: Array<{ id: string; name: string }>;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
  loading?: boolean;
  onRevoke(clientIDs: string[]): void;
}

const ConnectedAppItem: Component<ConnectedAppItemProps> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const access = () => {
    if (props.type === "cli") return "All workspaces";

    const workspaces = props.workspaces.map(({ name }) => name).join(", ") || "No workspaces";
    const readOnly = !props.scopes.includes("andesine:write");

    return readOnly ? `${workspaces} (read only)` : workspaces;
  };
  const dropdownOptions = createMemo(() => {
    const selectedIDs = selection();
    const isMulti = selectedIDs.length > 1;

    return [
      [
        {
          label: isMulti ? `Revoke ${selectedIDs.length} apps` : "Revoke access",
          icon: "i-lucide:unplug",
          color: "danger" as const,
          shortcut: "$mod+backspace",
          onClick: () => {
            props.onRevoke(isMulti ? selectedIDs : [props.clientID]);
            setSelection([]);
          }
        }
      ]
    ];
  });

  createEffect(() => {
    if (menuOpened()) {
      setSelection((selectedIDs) => {
        return selectedIDs.includes(props.clientID) ? selectedIDs : [props.clientID];
      });
    }
  });

  return (
    <DropdownArea>
      <TreeItem
        keyboardMenu={!props.loading ? dropdownOptions().flat() : []}
        onOpenMenu={() => {
          if (!props.loading) setMenuOpened(true);
        }}
        id={props.clientID}
        label={props.name}
        topLevel
        checkbox={!props.loading}
        selectable={!props.loading}
        class={clsx("px-1 py-0.5", props.loading && "animate-pulse")}
        icon={
          <div
            class={clsx(
              "h-5 w-5 text-gray-400",
              props.type === "cli" ? "i-lucide:square-terminal" : "i-lucide:plug"
            )}
          />
        }
        renderLabel={(label) => (
          <div class="flex min-w-0 flex-1 items-center gap-1.5" title={props.name}>
            <div class="min-w-0 shrink truncate">{label}</div>
            <div class="hidden h-4 w-px shrink-0 rounded-full bg-gray-200 md:block" />
            <span class="hidden min-w-0 flex-1 truncate text-xs text-gray-400 md:inline">
              {access()}
            </span>
            <span class="ml-auto shrink-0 text-xs text-gray-400">
              {props.lastUsedAt
                ? `Used ${formatRelativeTime(props.lastUsedAt)}`
                : formatDate(props.connectedAt)}
            </span>
          </div>
        )}
        actions={
          <div onClick={(event: MouseEvent) => event.stopPropagation()}>
            <DropdownMenu
              title={props.name}
              cardProps={
                { "class": "w-48", "data-tree-interaction": "" } as Partial<
                  ComponentProps<typeof Card>
                >
              }
              opened={menuOpened()}
              portal={false}
              setOpened={setMenuOpened}
              trigger={() => (
                <div
                  class={clsx(
                    !menuOpened() &&
                      !props.loading &&
                      "opacity-20 media-mouse:group-hover:opacity-100"
                  )}
                >
                  <IconButton
                    icon="i-lucide:ellipsis-vertical"
                    variant="ghost"
                    loading={props.loading}
                  />
                </div>
              )}
              items={dropdownOptions()}
            />
          </div>
        }
      />
    </DropdownArea>
  );
};

export { ConnectedAppItem };
