import { authClient } from "#web/lib/api";
import { DropdownArea, DropdownMenu, type MenuItem } from "@andesine/components";
import { type Component, createMemo, createSignal, type JSX, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { type SessionInfo, type WorkspaceInfo, useWorkspace } from "#web/context/workspace";
import { clearPersistenceData } from "#web/context/workspace/indexeddb";
import clsx from "clsx";
import { createMutation } from "@tanstack/solid-query";
import { isOffline } from "#web/lib/offline";
import { resetAnalytics } from "#web/lib/analytics";
import { appendRedirectTo } from "#web/lib/navigation";

interface AccountHeaderProps {
  name?: string;
  detail?: string;
  image?: string | null;
}
/** The accounts, where there's no workspace context, e.g. a share page. */
interface ProfileMenuAccount {
  currentWorkspace(): WorkspaceInfo | undefined;
  workspaces(): WorkspaceInfo[];
  sessions(): SessionInfo[];
  switchWorkspace(id: string, userID?: string): Promise<void>;
  /** The active account, when there's no current workspace. */
  currentUserID?(): string | undefined;
}
interface ProfileMenuProps {
  color?: "base" | "contrast";
  class?: string;
  compact?: boolean;
  account?: ProfileMenuAccount;
  placement?: "top-start" | "bottom-end";
  /** Where log out and added accounts go instead of the default. */
  returnPath?: string;
  trigger?(): JSX.Element;
}

const AccountHeader: Component<AccountHeaderProps> = (props) => (
  <div class="flex items-center gap-2 px-1 py-1 md:py-0.5">
    <Show when={props.image}>
      {(image) => (
        <img
          src={image()}
          alt={`${props.name} avatar`}
          class="h-8 w-8 shrink-0 rounded-md object-contain"
        />
      )}
    </Show>
    <div class="flex min-h-10 min-w-0 flex-col justify-center md:min-h-0">
      <span
        class={clsx(
          "text-[16px] font-medium text-gray-900 truncate md:text-sm",
          props.image ? "leading-tight md:leading-tight" : "leading-5 md:leading-5"
        )}
      >
        {props.name}
      </span>
      <span class="text-sm leading-4 text-gray-500 truncate md:text-xs md:leading-tight">
        {props.detail}
      </span>
    </div>
  </div>
);
const SwitchWorkspaceIcon = () => (
  <div class="h-full w-full relative">
    <div class="h-full w-full absolute top-0 left-0 i-lucide:hexagon z-1" />
    <div class="h-3.5 w-3.5 absolute -bottom-0.5 -right-0.5 i-tabler:hexagon-filled opacity-40" />
  </div>
);
/** Returns the account that becomes active, if any. */
const logOutAccount = async (
  sessions: SessionInfo[],
  userID?: string
): Promise<SessionInfo | null> => {
  const current = sessions.find(({ user }) => user.id === userID);
  const other = sessions.find(({ user }) => user.id !== userID);

  if (userID) await clearPersistenceData({ userID });

  if (sessions.length <= 1) {
    const { error } = await authClient.signOut();

    if (error) throw error;

    resetAnalytics();

    return null;
  }

  if (!current || !other) throw new Error("The account's session wasn't found");

  const { error: revokeError } = await authClient.multiSession.revoke({
    sessionToken: current.sessionToken
  });

  if (revokeError) throw revokeError;

  const { error: activateError } = await authClient.multiSession.setActive({
    sessionToken: other.sessionToken
  });

  if (activateError) throw activateError;

  return other;
};
const ProfileMenu: Component<ProfileMenuProps> = (props) => {
  const account: ProfileMenuAccount = props.account ?? useWorkspace();
  const { currentWorkspace, workspaces, sessions, switchWorkspace } = account;
  const currentUserID = () => account.currentUserID?.() ?? currentWorkspace()?.userID;
  const navigate = useNavigate();
  const logOutMutation = createMutation(() => ({
    mutationFn: () => logOutAccount(sessions(), currentUserID()),
    onSuccess: (other) => {
      const otherWorkspace = other && workspaces().find(({ userID }) => userID === other.user.id);
      const otherPath = otherWorkspace ? `/${otherWorkspace.id}/` : "/new-workspace";

      window.location.href = props.returnPath ?? (other ? otherPath : "/auth/sign-in");
    },
    onError: () => window.location.reload()
  }));
  const [menuOpened, setMenuOpened] = createSignal(false);
  const logoutPending = () => logOutMutation.isPending;

  const dropdownOptions = createMemo(() => {
    const dropdownOptions: Array<Array<MenuItem | (() => JSX.Element)>> = [];
    const sessionList = sessions();
    const workspaceList = workspaces();
    const currentUser = sessionList.find((session) => {
      return session.user.id === currentUserID();
    })?.user;

    dropdownOptions.push([
      () => (
        <AccountHeader
          name={currentUser?.name || currentUser?.email}
          detail={currentUser?.email}
          image={currentUser?.image}
        />
      )
    ]);

    if (isOffline()) return dropdownOptions;

    if (sessionList.length > 0) {
      const switchWorkspaceChildren: Array<Array<MenuItem | (() => JSX.Element)>> = sessionList.map(
        (session) => {
          const userWorkspaces = workspaceList.filter((ws) => ws.userID === session.user.id);

          return [
            [
              () => (
                <AccountHeader
                  name={session.user?.name || session.user?.email}
                  detail={session.user?.email}
                  image={session.user?.image}
                />
              )
            ],
            userWorkspaces.map((ws) => ({
              label: ws.name,
              icon: ws.logo
                ? () => (
                    <img
                      src={ws.logo!}
                      alt={`${ws.name} logo`}
                      class="h-full w-full rounded object-contain"
                    />
                  )
                : "i-lucide:hexagon",
              selected:
                ws.id === currentWorkspace()?.id && ws.userID === currentWorkspace()?.userID,
              onClick() {
                return switchWorkspace(ws.id, ws.userID);
              }
            }))
          ] as unknown as Array<MenuItem | (() => JSX.Element)>;
        }
      );

      dropdownOptions.push([
        {
          label: "Switch workspace",
          icon: SwitchWorkspaceIcon,
          items: switchWorkspaceChildren
        }
      ]);
    } else {
      // Fallback: simple workspace list
      const workspaceOptions: Array<MenuItem | (() => JSX.Element)> = workspaceList.map((ws) => ({
        label: ws.name,
        icon: ws.logo
          ? () => (
              <img
                src={ws.logo!}
                alt={`${ws.name} logo`}
                class="h-full w-full rounded-md object-contain"
              />
            )
          : "i-lucide:hexagon",
        selected: ws.id === currentWorkspace()?.id,
        onClick() {
          return switchWorkspace(ws.id);
        }
      }));

      if (workspaceOptions.length > 0) {
        dropdownOptions.push([
          { label: "Switch workspace", icon: "i-lucide:users", items: workspaceOptions }
        ]);
      }
    }

    // Create workspace + Add account
    dropdownOptions.push([
      {
        label: "Create workspace",
        icon: "i-lucide:plus",
        onClick() {
          navigate("/new-workspace");
        }
      },
      {
        label: "Add account",
        icon: "i-lucide:user-plus",
        onClick() {
          navigate(appendRedirectTo("/auth/sign-in", props.returnPath, true));
        }
      }
    ]);

    // Logout
    dropdownOptions.push([
      {
        label: logoutPending() ? "Logging out..." : "Log out",
        icon: "i-lucide:log-out",
        color: "danger",
        onClick() {
          if (!logoutPending()) logOutMutation.mutate();
        }
      }
    ]);

    return dropdownOptions;
  });
  return (
    <div class={props.class}>
      <DropdownArea>
        <DropdownMenu
          title="Account"
          class={props.compact ? "h-full w-full" : undefined}
          cardProps={{ class: "w-56" }}
          opened={menuOpened()}
          setOpened={setMenuOpened}
          placement={props.placement ?? "top-start"}
          trigger={
            props.trigger ??
            (() => (
              <button
                aria-label={props.compact ? "Account" : undefined}
                class={clsx(
                  "flex gap-1 items-center w-full px-1 py-1 transition-colors focus:outline-none",
                  props.compact ? "h-full justify-center" : "rounded-lg",
                  "@hover:bg-gray-200"
                )}
              >
                <Show
                  when={currentWorkspace()?.logo}
                  fallback={<div class="i-lucide:hexagon h-5 w-5 text-gray-500" />}
                >
                  {(logo) => (
                    <img
                      src={logo()}
                      alt={`${currentWorkspace()?.name} logo`}
                      class="h-5 w-5 shrink-0 rounded object-contain md:mr-0.5"
                    />
                  )}
                </Show>
                <Show when={!props.compact}>
                  <span class="min-w-0 flex-1 truncate text-start text-sm font-medium">
                    {currentWorkspace()?.name || "Workspace"}
                  </span>
                  <div class="i-lucide:chevrons-up-down h-4 w-4 text-gray-400" />
                </Show>
              </button>
            ))
          }
          items={dropdownOptions()}
        />
      </DropdownArea>
    </div>
  );
};

export { AccountHeader, logOutAccount, ProfileMenu };
