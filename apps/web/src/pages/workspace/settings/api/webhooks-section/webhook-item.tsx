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
import type { Webhook } from "#web/lib/data";
import { formatRelativeTime } from "#web/lib/primitives";
import { getWebhookHost } from "../../webhook/configuration";

interface WebhookState {
  enabled: boolean;
  disabledReason: string | null;
  health: Webhook["health"];
}
interface WebhookItemProps {
  canManage: boolean;
  loading?: boolean;
  webhook: Webhook;
  getWebhooks(ids: string[]): Webhook[];
  onDelete(webhooks: Webhook[]): void;
  onEvents(): void;
  onEdit(): void;
  onRotate(): void;
  onSetEnabled(webhooks: Webhook[], enabled: boolean): void;
}

// Extension webhooks also pause while their extension is off (`extension`).
const getStateIcon = (webhook: WebhookState) => {
  if (webhook.enabled) return "i-lucide:webhook text-gray-400";
  if (webhook.disabledReason === "failures") return "i-lucide:circle-alert text-red-500";

  // Matches the gradient used for expiring API keys.
  return "i-lucide:circle-pause bg-gradient-to-tr from-primary to-secondary";
};
const formatCount = (count: number) => (count === 1 ? "1 webhook" : `${count} webhooks`);
// Summarizes endpoint health for the state icon tooltip.
const getStateLabel = (webhook: WebhookState) => {
  const { lastFailureAt, lastSuccessAt, consecutiveFailures } = webhook.health;

  if (webhook.disabledReason === "failures") {
    return lastFailureAt
      ? `Disabled after repeated failures. Last failure ${formatRelativeTime(lastFailureAt)}`
      : "Disabled after repeated failures";
  }

  if (webhook.disabledReason === "extension") return "Paused while the extension is off";
  if (!webhook.enabled) return "Disabled";

  if (consecutiveFailures > 0 && lastFailureAt) {
    return `Enabled. Failing since ${formatRelativeTime(webhook.health.firstFailureAt || lastFailureAt)}`;
  }

  return lastSuccessAt ? `Enabled. Last delivered ${formatRelativeTime(lastSuccessAt)}` : "Enabled";
};

const WebhookItem: Component<WebhookItemProps> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const eventCount = () => props.webhook.eventTypes.length;
  // Readers can open the webhook and its events; managers also get the actions.
  const singleOptions = () => [
    [
      {
        label: props.canManage ? "Edit" : "View",
        shortcut: "f2",
        icon: props.canManage ? "i-lucide:pencil" : "i-lucide:eye",
        onClick: props.onEdit
      },
      { label: "See events", icon: "i-lucide:send", onClick: props.onEvents },
      ...(props.canManage
        ? [
            {
              label: props.webhook.enabled ? "Disable" : "Enable",
              icon: props.webhook.enabled ? "i-lucide:pause" : "i-lucide:play",
              onClick: () => props.onSetEnabled([props.webhook], !props.webhook.enabled)
            },
            { label: "Rotate secret", icon: "i-lucide:rotate-ccw-key", onClick: props.onRotate }
          ]
        : [])
    ],
    ...(props.canManage
      ? [
          [
            {
              label: "Delete",
              icon: "i-lucide:trash",
              color: "danger" as const,
              shortcut: "$mod+backspace",
              onClick: () => props.onDelete([props.webhook])
            }
          ]
        ]
      : [])
  ];
  // Group actions apply only to webhooks that need the change.
  const multiOptions = (selected: Webhook[]) => {
    const disabled = selected.filter((webhook) => !webhook.enabled);
    const enabled = selected.filter((webhook) => webhook.enabled);
    const apply = (action: () => void) => () => {
      action();
      setSelection([]);
    };

    return [
      [
        ...(disabled.length
          ? [
              {
                label: `Enable ${formatCount(disabled.length)}`,
                icon: "i-lucide:play",
                onClick: apply(() => props.onSetEnabled(disabled, true))
              }
            ]
          : []),
        ...(enabled.length
          ? [
              {
                label: `Disable ${formatCount(enabled.length)}`,
                icon: "i-lucide:pause",
                onClick: apply(() => props.onSetEnabled(enabled, false))
              }
            ]
          : [])
      ],
      [
        {
          label: `Delete ${formatCount(selected.length)}`,
          icon: "i-lucide:trash",
          color: "danger" as const,
          shortcut: "$mod+backspace",
          onClick: apply(() => props.onDelete(selected))
        }
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
        return selectedIDs.includes(props.webhook.id) ? selectedIDs : [props.webhook.id];
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
        id={props.webhook.id}
        label={props.webhook.name}
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
          <div class="flex min-w-0 flex-1 items-center gap-1.5" title={props.webhook.name}>
            <div class={clsx("min-w-0 truncate", !props.webhook.enabled && "line-through")}>
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
              title={props.webhook.name}
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

export { WebhookItem, getStateIcon, getStateLabel };
