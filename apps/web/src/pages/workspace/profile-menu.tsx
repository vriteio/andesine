import { authClient } from "#web/lib/api";
import { DropdownArea, DropdownMenu, type MenuItem } from "@andesine/components";
import { type Component, createMemo, createSignal, type JSX, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useWorkspace } from "#web/context/workspace";
import { clearPersistenceData } from "#web/context/workspace/indexeddb";
import clsx from "clsx";
import { createMutation } from "@tanstack/solid-query";
import { isOffline } from "#web/lib/offline";

interface ProfileMenuProps {
  color?: "base" | "contrast";
  class?: string;
  compact?: boolean;
}

const ProfileMenu: Component<ProfileMenuProps> = (props) => {
  const { currentWorkspace, workspaces, sessions, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const revokeSessionMutation = createMutation(() => ({
    mutationFn: async (input: {
      sessionToken: string;
      nextSessionToken: string;
      nextPath: string;
    }) => {
      const { error: revokeError } = await authClient.multiSession.revoke({
        sessionToken: input.sessionToken
      });

      if (revokeError) throw revokeError;

      const { error: activateError } = await authClient.multiSession.setActive({
        sessionToken: input.nextSessionToken
      });

      if (activateError) throw activateError;

      return input.nextPath;
    },
    onSuccess: (nextPath) => {
      window.location.href = nextPath;
    },
    onError: () => {
      window.location.reload();
    }
  }));
  const signOutMutation = createMutation(() => ({
    mutationFn: async () => {
      await authClient.signOut();

      return true;
    }
  }));
  const [menuOpened, setMenuOpened] = createSignal(false);
  const logoutPending = () => {
    return revokeSessionMutation.isPending || signOutMutation.isPending;
  };

  const dropdownOptions = createMemo(() => {
    const dropdownOptions: Array<Array<MenuItem | (() => JSX.Element)>> = [];
    const sessionList = sessions();
    const workspaceList = workspaces();
    const currentUser = sessionList.find((session) => {
      return session.user.id === currentWorkspace()?.userID;
    })?.user;

    dropdownOptions.push([
      () => (
        <div class="flex items-center gap-2 px-1 py-1 md:py-0.5">
          <Show when={currentUser?.image}>
            {(image) => (
              <img
                src={image()}
                alt={`${currentUser?.name} avatar`}
                class="h-8 w-8 shrink-0 rounded-md object-contain"
              />
            )}
          </Show>
          <div class="flex min-h-10 min-w-0 flex-col justify-center md:min-h-0">
            <span
              class={clsx(
                "text-[16px] font-medium text-gray-900 line-clamp-1 md:text-sm",
                currentUser?.image ? "leading-none md:leading-none" : "leading-5 md:leading-5"
              )}
            >
              {currentUser?.name || currentUser?.email}
            </span>
            <span class="text-sm leading-4 text-gray-500 line-clamp-1 md:text-xs md:leading-none">
              {currentUser?.email}
            </span>
          </div>
        </div>
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
                <div class="flex items-center gap-2 px-1 py-1 md:py-0.5">
                  <Show when={session.user?.image}>
                    {(image) => (
                      <img
                        src={image()}
                        alt={`${session.user?.name} avatar`}
                        class="h-8 w-8 shrink-0 rounded-md object-contain"
                      />
                    )}
                  </Show>
                  <div class="flex min-h-10 min-w-0 flex-col justify-center md:min-h-0">
                    <span
                      class={clsx(
                        "text-[16px] font-medium text-gray-900 line-clamp-1 md:text-sm",
                        session.user?.image
                          ? "leading-none md:leading-none"
                          : "leading-5 md:leading-5"
                      )}
                    >
                      {session.user?.name || session.user?.email}
                    </span>
                    <span class="text-sm leading-4 text-gray-500 line-clamp-1 md:text-xs md:leading-none">
                      {session.user?.email}
                    </span>
                  </div>
                </div>
              )
            ],
            userWorkspaces.map((ws) => ({
              label: ws.name,
              icon: () => (
                <Show when={ws.logo} fallback={<div class="i-lucide:hexagon h-full w-full" />}>
                  {(logo) => (
                    <img
                      src={logo()}
                      alt={`${ws.logo} logo`}
                      class="h-full w-full rounded object-contain"
                    />
                  )}
                </Show>
              ),
              selected: ws.id === currentWorkspace()?.id,
              onClick() {
                return switchWorkspace(ws.id);
              }
            }))
          ] as unknown as Array<MenuItem | (() => JSX.Element)>;
        }
      );

      dropdownOptions.push([
        {
          label: "Switch workspace",
          icon: () => (
            <div class="h-full w-full relative">
              <div class="h-full w-full absolute top-0 left-0 i-lucide:hexagon z-1" />
              <div class="h-3.5 w-3.5 absolute -bottom-0.5 -right-0.5 i-tabler:hexagon-filled opacity-40" />
            </div>
          ),
          items: switchWorkspaceChildren
        }
      ]);
    } else {
      // Fallback: simple workspace list
      const workspaceOptions: Array<MenuItem | (() => JSX.Element)> = workspaceList.map((ws) => ({
        label: ws.name,
        icon: () => (
          <Show when={ws.logo} fallback={<div class="i-lucide:hexagon h-full w-full" />}>
            {(logo) => (
              <img
                src={logo()}
                alt={`${ws.name} logo`}
                class="h-full w-full rounded-md object-contain"
              />
            )}
          </Show>
        ),
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
          navigate("/auth/sign-in?addAccount=true");
        }
      }
    ]);

    // Logout
    dropdownOptions.push([
      {
        label: logoutPending() ? "Logging out..." : "Log out",
        icon: "i-lucide:log-out",
        color: "danger",
        async onClick() {
          if (logoutPending()) return;

          const sessionList = sessions();
          const current = currentWorkspace();

          if (current) await clearPersistenceData({ userID: current.userID });

          if (sessionList.length > 1) {
            const currentSession = sessionList.find((s) => s.user.id === current?.userID);
            const otherSession = sessionList.find((s) => s.user.id !== current?.userID);
            const otherWorkspace = workspaceList.find(
              (ws) => otherSession && ws.userID === otherSession.user.id
            );

            if (!currentSession || !otherSession) {
              window.location.reload();

              return;
            }

            await revokeSessionMutation.mutateAsync({
              sessionToken: currentSession.sessionToken,
              nextSessionToken: otherSession.sessionToken,
              nextPath: otherWorkspace ? `/${otherWorkspace.id}/` : "/new-workspace"
            });
          } else {
            await signOutMutation.mutateAsync();
            window.location.href = "/auth/sign-in";
          }
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
          placement="top-start"
          trigger={() => (
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
                <span class="flex-1 truncate text-start text-sm font-medium">
                  {currentWorkspace()?.name || "Workspace"}
                </span>
                <div class="i-lucide:chevrons-up-down h-4 w-4 text-gray-400" />
              </Show>
            </button>
          )}
          items={dropdownOptions()}
        />
      </DropdownArea>
    </div>
  );
};

export { ProfileMenu };
