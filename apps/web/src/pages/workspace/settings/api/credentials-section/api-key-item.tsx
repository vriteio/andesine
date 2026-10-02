import { type Card, DropdownArea, DropdownMenu, IconButton, Tooltip } from "@andesine/components";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  Show
} from "solid-js";
import clsx from "clsx";
import { TreeItem, useTree } from "#web/components/tree";
import { useClipboard } from "#web/context/clipboard";
import type { KeyKind, KeyPermission } from "#web/lib/api";
import { useDelegationPermissions } from "#web/lib/policy/delegation";
import { formatDate, formatRelativeTime } from "#web/lib/primitives";

interface APIKeyItemProps {
  canManage: boolean;
  id: string;
  name: string;
  prefix: string;
  kind: KeyKind;
  /** The raw value of a publishable key. */
  value: string | null;
  permissions: KeyPermission[];
  createdAt: Date | string;
  expiresAt: string | null;
  loading?: boolean;
  onEdit(): void;
  onRotate(): void;
  onDelete(ids: string[]): void;
}

const APIKeyItem: Component<APIKeyItemProps> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const { canGrantKeyPermission } = useDelegationPermissions();
  const { copyText } = useClipboard();
  const dropdownOptions = createMemo(() => {
    const selectedIDs = selection();
    const isMulti = selectedIDs.length > 1;

    return [
      ...(!isMulti && props.value
        ? [
            [
              {
                label: "Copy key",
                shortcut: "$mod+alt+c",
                icon: "i-lucide:copy",
                onClick: () => {
                  void copyText(props.value!, {
                    success: "Publishable key copied to clipboard",
                    fallback: { title: "Copy publishable key manually" }
                  });
                }
              }
            ]
          ]
        : []),
      ...(!isMulti && !props.expiresAt
        ? [
            [
              { label: "Edit", shortcut: "f2", icon: "i-lucide:pencil", onClick: props.onEdit },
              {
                label: "Rotate key",
                disabled: !props.permissions.every(canGrantKeyPermission),
                icon: "i-lucide:rotate-ccw-key",
                onClick: props.onRotate
              }
            ]
          ]
        : []),
      [
        {
          label: isMulti ? `Delete ${selectedIDs.length} keys` : "Delete",
          icon: "i-lucide:trash",
          color: "danger" as const,
          shortcut: "$mod+backspace",
          onClick: () => {
            props.onDelete(isMulti ? selectedIDs : [props.id]);
            setSelection([]);
          }
        }
      ]
    ];
  });

  createEffect(() => {
    if (menuOpened()) {
      setSelection((selectedIDs) => (selectedIDs.includes(props.id) ? selectedIDs : [props.id]));
    }
  });

  return (
    <DropdownArea>
      <TreeItem
        keyboardMenu={props.canManage && !props.loading ? dropdownOptions().flat() : []}
        onOpenMenu={() => {
          if (props.canManage && !props.loading) setMenuOpened(true);
        }}
        id={props.id}
        label={props.name}
        topLevel
        checkbox={props.canManage && !props.loading && !props.expiresAt}
        selectable={props.canManage && !props.loading && !props.expiresAt}
        class={clsx("px-1 py-0.5", props.loading && "animate-pulse")}
        icon={
          <Show
            when={props.expiresAt}
            fallback={
              <div
                class={clsx(
                  "h-5 w-5 text-gray-400",
                  props.kind === "publishable" ? "i-tabler:circle-key" : "i-lucide:key-round"
                )}
              />
            }
          >
            <Tooltip content={`Expires ${formatRelativeTime(props.expiresAt!)}`} fixed>
              <div class="h-5 w-5 i-lucide:clock bg-gradient-to-tr from-primary to-secondary" />
            </Tooltip>
          </Show>
        }
        onClick={props.canManage ? props.onEdit : undefined}
        renderLabel={(label) => (
          <div class="flex min-w-0 flex-1 items-center gap-1.5">
            <div class="flex min-w-0 flex-1 items-center gap-1.5" title={props.name}>
              <div class={clsx("min-w-0 truncate", props.expiresAt && "line-through")}>{label}</div>
              <div class="hidden h-4 w-px shrink-0 rounded-full bg-gray-200 md:block" />
              <span class="hidden shrink-0 font-mono text-xs text-gray-400 md:inline">
                {props.prefix}...
              </span>
              <div class="flex-1" />
              <span class={clsx("text-xs text-gray-400 shrink-0")}>
                {formatDate(props.createdAt)}
              </span>
            </div>
          </div>
        )}
        actions={
          <Show when={props.canManage}>
            <div onClick={(event: MouseEvent) => event.stopPropagation()}>
              <DropdownMenu
                title={props.name}
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
                      size="small"
                      variant="text"
                      text="soft"
                      loading={props.loading}
                    />
                  </div>
                )}
                items={dropdownOptions()}
              />
            </div>
          </Show>
        }
      />
    </DropdownArea>
  );
};

export { APIKeyItem };
