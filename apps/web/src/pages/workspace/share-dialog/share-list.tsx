import { Card, createRef, ScrollShadow } from "@andesine/components";
import { type Component, For, Show } from "solid-js";
import { type Share } from "#web/lib/data";
import { type ShareChanges } from "./settings";
import { ShareRow } from "./share-row";

interface ShareListProps {
  link?: Share;
  emailShares: Share[];
  /** Where the rows' menus mount, inside the dialog. */
  menuMount?: HTMLElement;
  linkSharing: boolean;
  emailSharing: boolean;
  maxExpiryDays: number | null;
  onUpdate(id: string, changes: ShareChanges): void;
  onRemove(id: string): void;
  onResetLink(): void;
  onTurnOffLink(): void;
}

const ShareList: Component<ShareListProps> = (props) => {
  const [listRef, setListRef] = createRef<HTMLElement | null>(null);

  return (
    <Card
      class="relative flex flex-col overflow-hidden rounded-lg border-0 p-0 text-sm"
      color="contrast"
    >
      <ScrollShadow color="contrast" scrollableContainerRef={listRef} />
      <div
        ref={setListRef}
        class="flex max-h-[50vh] flex-col gap-2 overflow-y-auto p-2 scrollbar-contrast"
      >
        <Show
          when={props.link}
          fallback={
            <div class="flex items-start gap-1.5">
              <div class="flex h-6 w-6 items-center justify-center">
                <div class="i-lucide:lock h-5 w-5 shrink-0 text-gray-400" />
              </div>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="h-6 truncate text-base">Link sharing is off</span>
                <span class="-mt-1 truncate text-xs text-gray-400">
                  {props.linkSharing
                    ? "Only invited people can open the entry"
                    : "Turned off in the workspace settings"}
                </span>
              </div>
            </div>
          }
        >
          {(share) => (
            <ShareRow
              menuMount={props.menuMount}
              icon="i-lucide:globe"
              label="Anyone with the link"
              share={share()}
              paused={!props.linkSharing}
              maxExpiryDays={props.maxExpiryDays}
              onChange={(changes) => props.onUpdate(share().id, changes)}
              actions={[
                // A paused link can't get a new token.
                ...(props.linkSharing
                  ? [
                      {
                        label: "Reset link",
                        icon: "i-lucide:refresh-cw",
                        onClick: props.onResetLink
                      }
                    ]
                  : []),
                {
                  label: "Turn off link",
                  icon: "i-lucide:link-2-off",
                  color: "danger" as const,
                  onClick: props.onTurnOffLink
                }
              ]}
            />
          )}
        </Show>
        <For each={props.emailShares}>
          {(share) => (
            <>
              <div class="h-px w-full shrink-0 rounded-full bg-gray-200" />
              <ShareRow
                menuMount={props.menuMount}
                icon="i-lucide:mail"
                label={share.email ?? ""}
                share={share}
                paused={!props.emailSharing}
                maxExpiryDays={props.maxExpiryDays}
                onChange={(changes) => props.onUpdate(share.id, changes)}
                actions={[
                  {
                    label: "Remove",
                    icon: "i-lucide:trash-2",
                    color: "danger",
                    onClick: () => props.onRemove(share.id)
                  }
                ]}
              />
            </>
          )}
        </For>
      </div>
    </Card>
  );
};

export { ShareList };
