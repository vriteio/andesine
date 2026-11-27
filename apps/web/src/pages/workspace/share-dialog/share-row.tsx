import { DropdownArea, DropdownMenu, IconButton, type MenuItem } from "@andesine/components";
import { type Component, createSignal, Show } from "solid-js";
import { TimeAgo } from "#web/components/time-ago";
import { type Share } from "#web/lib/data";
import { ACCESS_LABELS, getSettingsItems, type ShareChanges, toExpiresAt } from "./settings";

interface ShareDetailsProps {
  share: Share;
  /** Its kind is turned off in the workspace. */
  paused: boolean;
  tooltips: boolean;
}
interface ShareRowProps {
  /** Where its menu mounts, inside the dialog. */
  menuMount?: HTMLElement;
  icon: string;
  label: string;
  share: Share;
  paused: boolean;
  maxExpiryDays: number | null;
  /** The last menu items, e.g. to reset the link or remove the share. */
  actions: MenuItem[];
  onChange(changes: ShareChanges): void;
}

const ShareDetails: Component<ShareDetailsProps> = (props) => (
  <span class="flex min-w-0 items-center gap-1 text-xs text-gray-400">
    <Show when={props.paused}>
      <span class="shrink-0 text-amber-600">Paused</span>
      <span class="h-3 w-px shrink-0 bg-gray-400 opacity-20" />
    </Show>
    <span class="truncate">{ACCESS_LABELS[props.share.access]}</span>
    <span class="h-3 w-px shrink-0 bg-gray-400 opacity-20" />
    <Show when={props.share.expiresAt} fallback={<span class="truncate">No expiry</span>}>
      {(expiresAt) => (
        <>
          <span class="shrink-0">{new Date(expiresAt()) > new Date() ? "Expires" : "Expired"}</span>
          <TimeAgo date={expiresAt()} meta="Expiry" enabled={props.tooltips} />
        </>
      )}
    </Show>
  </span>
);
const ShareRow: Component<ShareRowProps> = (props) => {
  const [opened, setOpened] = createSignal(false);
  const items = (): MenuItem[][] => [
    getSettingsItems({
      access: props.share.access,
      // A set date isn't one of the relative options.
      expiry: props.share.expiresAt ? null : "never",
      maxExpiryDays: props.maxExpiryDays,
      setAccess: (access) => props.onChange({ access }),
      setExpiry: (value) => props.onChange({ expiresAt: toExpiresAt(value) })
    }),
    props.actions
  ];

  // Right-clicking the row opens its menu at the pointer.
  return (
    <DropdownArea>
      <div class="flex items-start gap-1.5">
        <div class="flex h-6 w-6 items-center justify-center">
          <div class={`${props.icon} h-5 w-5 shrink-0 text-gray-400`} />
        </div>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="h-6 truncate text-base">{props.label}</span>
          <div class="-mt-1">
            <ShareDetails share={props.share} paused={props.paused} tooltips={!opened()} />
          </div>
        </div>
        {/* Portaled past the list's scroll, into the dialog for its focus trap. */}
        <DropdownMenu
          title="Share settings"
          opened={opened()}
          setOpened={setOpened}
          placement="bottom-end"
          cardProps={{ class: "w-52" }}
          portalMount={props.menuMount}
          items={items()}
          trigger={() => (
            <IconButton
              icon="i-lucide:ellipsis-vertical"
              variant="ghost"
              aria-label="Share settings"
            />
          )}
        />
      </div>
    </DropdownArea>
  );
};

export { ShareRow };
