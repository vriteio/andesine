import { type ExtensionWebhookState } from "@andesine/contracts/extensions";
import { type Card, DropdownArea, DropdownMenu, IconButton, Tooltip } from "@andesine/components";
import clsx from "clsx";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal
} from "solid-js";
import { TreeItem, useTree } from "#web/components/tree";
import { getStateIcon, getStateLabel } from "../api/webhooks-section/webhook-item";
import { getWebhookHost } from "../webhook/configuration";

interface WebhookItemProps {
  canManage: boolean;
  loading?: boolean;
  webhook: ExtensionWebhookState;
  getWebhooks(ids: string[]): ExtensionWebhookState[];
  onEvents(): void;
  onSetEnabled(webhooks: ExtensionWebhookState[], enabled: boolean): void;
}

// The manager's choice: on while enabled or paused with its extension.
const isSwitchedOn = (webhook: ExtensionWebhookState): boolean => {
  return webhook.enabled || webhook.disabledReason === "extension";
};
const formatCount = (count: number) => (count === 1 ? "1 webhook" : `${count} webhooks`);

/** A row of the extension's webhooks, like the API page's webhook rows without editing. */
const WebhookItem: Component<WebhookItemProps> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const eventCount = () => props.webhook.eventTypes.length;
  const singleOptions = () => [
    [
      { label: "See events", icon: "i-lucide:send", onClick: props.onEvents },
      ...(props.canManage
        ? [
            {
              label: isSwitchedOn(props.webhook) ? "Disable" : "Enable",
              icon: isSwitchedOn(props.webhook) ? "i-lucide:pause" : "i-lucide:play",
              onClick: () => props.onSetEnabled([props.webhook], !isSwitchedOn(props.webhook))
            }
          ]
        : [])
    ]
  ];
  // Group actions apply only to webhooks that need the change.
  const multiOptions = (selected: ExtensionWebhookState[]) => {
    const off = selected.filter((webhook) => !isSwitchedOn(webhook));
    const on = selected.filter(isSwitchedOn);
    const apply = (action: () => void) => () => {
      action();
      setSelection([]);
    };

    return [
      [
        ...(off.length
          ? [
              {
                label: `Enable ${formatCount(off.length)}`,
                icon: "i-lucide:play",
                onClick: apply(() => props.onSetEnabled(off, true))
              }
            ]
          : []),
        ...(on.length
          ? [
              {
                label: `Disable ${formatCount(on.length)}`,
                icon: "i-lucide:pause",
                onClick: apply(() => props.onSetEnabled(on, false))
              }
            ]
          : [])
      ]
    ];
  };
  const dropdownOptions = createMemo(() => {
    const selected = props.getWebhooks(selection());

    return props.canManage && selected.length > 1 ? multiOptions(selected) : singleOptions();
  });
  const menuAvailable = () => !props.loading;
  // A function, so reading it in TreeItem's event handlers creates no memo.
  const selectable = () => props.canManage && !props.loading;

  createEffect(() => {
    if (menuOpened()) {
      setSelection((selectedIDs) => {
        return selectedIDs.includes(props.webhook.webhookID)
          ? selectedIDs
          : [props.webhook.webhookID];
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
        id={props.webhook.webhookID}
        label={props.webhook.webhookID}
        topLevel
        checkbox={selectable()}
        selectable={selectable()}
        class={clsx("px-1 py-0.5", props.loading && "animate-pulse")}
        icon={
          <Tooltip content={getStateLabel(props.webhook)} fixed>
            <div class={clsx("h-5 w-5", getStateIcon(props.webhook))} />
          </Tooltip>
        }
        onClick={props.onEvents}
        renderLabel={(label) => (
          <div class="flex min-w-0 flex-1 items-center gap-1.5" title={props.webhook.webhookID}>
            <div class={clsx("min-w-0 truncate", !isSwitchedOn(props.webhook) && "line-through")}>
              {label}
            </div>
            <div class="hidden h-4 w-px shrink-0 rounded-full bg-gray-200 md:block" />
            <span class="hidden min-w-0 truncate font-mono text-xs text-gray-400 md:inline">
              {getWebhookHost(props.webhook.url)}
            </span>
            <div class="flex-1" />
            <span class="shrink-0 text-xs text-gray-400">
              {eventCount() === 1 ? "1 event" : `${eventCount()} events`}
            </span>
          </div>
        )}
        actions={
          <div onClick={(event: MouseEvent) => event.stopPropagation()}>
            <DropdownMenu
              title={props.webhook.webhookID}
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

export { WebhookItem, isSwitchedOn };
