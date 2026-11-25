import { type Invite, type Role } from "@andesine/contracts/entities";
import { useTree, TreeItem } from "#web/components/tree";
import { type Card, DropdownArea, DropdownMenu, IconButton } from "@andesine/components";
import clsx from "clsx";
import {
  type Component,
  createSignal,
  createMemo,
  createEffect,
  type ComponentProps
} from "solid-js";
import { formatDate } from "#web/lib/primitives";

const InviteItem: Component<{
  invite: Invite & { inviteLink: string };
  roles: Role[];
  loading?: boolean;
  onCopyLink(link: string): void;
  onRevoke(ids: string[]): void;
  onResend(ids: string[]): void;
}> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const inviteLabel = () => props.invite.email ?? "Invite link";
  const inviteRoleName = () => {
    return props.roles.find((role) => role.id === props.invite.roleID)?.name || "";
  };
  const dropdownOptions = createMemo(() => {
    const selectedIDs = selection();
    const isMulti = selectedIDs.length > 1;
    const canResend = isMulti || Boolean(props.invite.email);
    const targetIDs = isMulti ? selectedIDs : [props.invite.id];

    return [
      ...(!isMulti
        ? [
            [
              {
                label: "Copy invite link",
                shortcut: "$mod+alt+c",
                icon: "i-lucide:link",
                onClick: () => props.onCopyLink(props.invite.inviteLink)
              }
            ]
          ]
        : []),
      [
        ...(canResend
          ? [
              {
                label: isMulti ? `Resend ${selectedIDs.length} invitations` : "Resend invitation",
                icon: "i-lucide:send",
                onClick: () => props.onResend(targetIDs)
              }
            ]
          : []),
        {
          label: isMulti ? `Revoke ${selectedIDs.length} invitations` : "Revoke invitation",
          icon: "i-lucide:x",
          color: "danger" as const,
          shortcut: "$mod+backspace",
          onClick: () => {
            props.onRevoke(targetIDs);
            setSelection([]);
          }
        }
      ]
    ];
  });

  createEffect(() => {
    if (menuOpened()) {
      setSelection((selectedIDs) =>
        selectedIDs.includes(props.invite.id) ? selectedIDs : [props.invite.id]
      );
    }
  });

  return (
    <DropdownArea>
      <TreeItem
        keyboardMenu={!props.loading ? dropdownOptions().flat() : []}
        onOpenMenu={() => {
          if (!props.loading) setMenuOpened(true);
        }}
        id={props.invite.id}
        label={inviteLabel()}
        topLevel
        checkbox={!props.loading}
        selectable={!props.loading}
        class={clsx("px-1 py-0.5", props.loading && "animate-pulse")}
        icon={
          <div
            class={clsx(
              "h-5.5 w-5.5 text-gray-400",
              props.invite.email ? "i-lucide:mail" : "i-lucide:link"
            )}
          />
        }
        renderLabel={(label) => (
          <div
            class="flex min-w-0 flex-1 items-center gap-1.5"
            title={`${inviteLabel()} | ${inviteRoleName()}`}
          >
            <div class="min-w-0 max-w-48 truncate">{label}</div>
            <div class="hidden h-4 w-px shrink-0 rounded-full bg-gray-200 md:block" />
            <span class="hidden shrink-0 text-xs text-gray-400 md:inline">{inviteRoleName()}</span>
            <div class="flex-1" />
            <span class="shrink-0 text-xs text-gray-400">{formatDate(props.invite.createdAt)}</span>
          </div>
        )}
        actions={
          <div onClick={(event: MouseEvent) => event.stopPropagation()}>
            <DropdownMenu
              title={inviteLabel()}
              cardProps={
                { "class": "w-52", "data-tree-interaction": "" } as Partial<
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

export { InviteItem };
