import { type ExtensionSummary } from "@andesine/contracts/extensions";
import { type Card, DropdownArea, DropdownMenu, IconButton, Tooltip } from "@andesine/components";
import clsx from "clsx";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  Show
} from "solid-js";
import { ExtensionIcon } from "#web/components/extensions/extension-icon";
import { TreeItem, useTree } from "#web/components/tree";
import { formatExtensionCount, getStateIcon, getStateLabel } from "./state";

interface ExtensionItemProps {
  canManage: boolean;
  extension: ExtensionSummary;
  loading?: boolean;
  getExtensions(ids: string[]): ExtensionSummary[];
  onOpen(): void;
  onSetEnabled(extensions: ExtensionSummary[], enabled: boolean): void;
  onUninstall(extensions: ExtensionSummary[]): void;
}

const ExtensionItem: Component<ExtensionItemProps> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  // The manager's choice; an update or a revocation can still keep it from running.
  const enabled = () => props.extension.disabledReason !== "manual";
  // Only a state other than active is shown.
  const hasState = () => props.extension.disabledReason !== null;
  const singleOptions = () => [
    [
      {
        label: props.canManage ? "Settings" : "View",
        shortcut: "f2",
        icon: props.canManage ? "i-lucide:settings-2" : "i-lucide:eye",
        onClick: props.onOpen
      },
      ...(props.canManage
        ? [
            {
              label: enabled() ? "Disable" : "Enable",
              icon: enabled() ? "i-lucide:pause" : "i-lucide:play",
              onClick: () => props.onSetEnabled([props.extension], !enabled())
            }
          ]
        : [])
    ],
    ...(props.canManage
      ? [
          [
            {
              label: "Uninstall",
              icon: "i-lucide:trash",
              color: "danger" as const,
              shortcut: "$mod+backspace",
              onClick: () => props.onUninstall([props.extension])
            }
          ]
        ]
      : [])
  ];
  // Group actions apply only to extensions that need the change.
  const multiOptions = (selected: ExtensionSummary[]) => {
    const disabled = selected.filter((extension) => extension.disabledReason === "manual");
    const running = selected.filter((extension) => extension.disabledReason !== "manual");
    const apply = (action: () => void) => () => {
      action();
      setSelection([]);
    };

    return [
      [
        ...(disabled.length
          ? [
              {
                label: `Enable ${formatExtensionCount(disabled.length)}`,
                icon: "i-lucide:play",
                onClick: apply(() => props.onSetEnabled(disabled, true))
              }
            ]
          : []),
        ...(running.length
          ? [
              {
                label: `Disable ${formatExtensionCount(running.length)}`,
                icon: "i-lucide:pause",
                onClick: apply(() => props.onSetEnabled(running, false))
              }
            ]
          : [])
      ],
      [
        {
          label: `Uninstall ${formatExtensionCount(selected.length)}`,
          icon: "i-lucide:trash",
          color: "danger" as const,
          shortcut: "$mod+backspace",
          onClick: apply(() => props.onUninstall(selected))
        }
      ]
    ];
  };
  const dropdownOptions = createMemo(() => {
    const selected = props.getExtensions(selection());

    return props.canManage && selected.length > 1 ? multiOptions(selected) : singleOptions();
  });
  const menuAvailable = () => !props.loading;
  // A function, so reading it in TreeItem's event handlers creates no memo.
  const selectable = () => props.canManage && !props.loading;

  createEffect(() => {
    if (menuOpened()) {
      setSelection((selectedIDs) => {
        return selectedIDs.includes(props.extension.id) ? selectedIDs : [props.extension.id];
      });
    }
  });

  return (
    <DropdownArea>
      <TreeItem
        keyboardMenu={menuAvailable() ? dropdownOptions().flat() : []}
        onOpenMenu={() => {
          if (menuAvailable()) setMenuOpened(true);
        }}
        id={props.extension.id}
        label={props.extension.displayName}
        topLevel
        checkbox={selectable()}
        selectable={selectable()}
        class={clsx("px-1 py-0.5", props.loading && "animate-pulse")}
        icon={
          <Tooltip content={getStateLabel(props.extension)} enabled={hasState()} fixed>
            <div class="relative h-5 w-5">
              <ExtensionIcon
                name={props.extension.name}
                icon={props.extension.icon}
                iconStyles={props.extension.iconStyles}
                class="h-5 w-5"
              />
              {/* The state, as a badge on the icon's corner. */}
              <Show when={hasState()}>
                <div class="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
                  <div class={clsx("h-3 w-3", getStateIcon(props.extension))} />
                </div>
              </Show>
            </div>
          </Tooltip>
        }
        onClick={props.onOpen}
        renderLabel={(label) => (
          <div class="flex min-w-0 flex-1 items-center gap-1.5">
            <Tooltip
              content={getStateLabel(props.extension)}
              enabled={hasState()}
              wrapperClass="min-w-0"
              fixed
            >
              <div
                class={clsx(
                  "min-w-0 truncate",
                  props.extension.state !== "active" && "line-through"
                )}
              >
                {label}
              </div>
            </Tooltip>
            <Show when={props.extension.development}>
              <div class="hidden h-4 w-px shrink-0 rounded-full bg-gray-200 md:block" />
              <span class="hidden shrink-0 font-mono text-xs text-gray-400 md:inline">
                Development
              </span>
            </Show>
          </div>
        )}
        actions={
          <div onClick={(event: MouseEvent) => event.stopPropagation()}>
            <DropdownMenu
              title={props.extension.displayName}
              cardProps={
                {
                  "class": "w-48",
                  "data-tree-interaction": ""
                } as Partial<ComponentProps<typeof Card>>
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

export { ExtensionItem };
