import { IconButton } from "@andesine/components";
import { toUserID } from "@andesine/contracts/primitives";
import { createAsync, useLocation } from "@solidjs/router";
import { type Component, createSignal, For } from "solid-js";
import { listSessionsQuery } from "#web/context/workspace";
import { useNotify } from "#web/context/notifications";
import { authClient } from "#web/lib/api";
import { appendRedirectTo } from "#web/lib/navigation";
import { logOutAccount } from "../workspace/profile-menu";

interface AccountOptionsProps {
  /** The signed-in account, as Better Auth gives its ID. */
  userID: string;
}

const ACTION_PROPS = {
  class: "w-full gap-1",
  iconProps: { class: "h-5 w-5 text-gray-400" },
  text: "base",
  size: "medium"
} as const;

/** The profile menu's options that can open the share. */
const AccountOptions: Component<AccountOptionsProps> = (props) => {
  const location = useLocation();
  const notify = useNotify();
  const sessions = createAsync(() => listSessionsQuery());
  const [pending, setPending] = createSignal(false);
  const currentUserID = () => toUserID(props.userID);
  const otherSessions = () => {
    return (sessions() ?? []).filter(({ user }) => user.id !== currentUserID());
  };
  // Reloads, as the share opens with the active account.
  const run = async (action: () => Promise<unknown>) => {
    setPending(true);

    try {
      await action();
      window.location.reload();
    } catch (error) {
      console.error(error);
      notify({ type: "error", text: "Couldn't change the account" });
      setPending(false);
    }
  };
  const switchTo = (sessionToken: string) => {
    return run(async () => {
      const { error } = await authClient.multiSession.setActive({ sessionToken });

      if (error) throw error;
    });
  };
  const logOut = () => run(() => logOutAccount(sessions() ?? [], currentUserID()));

  return (
    <div class="flex flex-col gap-2">
      <For each={otherSessions()}>
        {(session) => (
          <IconButton
            {...ACTION_PROPS}
            icon="i-lucide:user-round-check"
            label={`Continue as ${session.user.email}`}
            disabled={pending()}
            onClick={() => switchTo(session.sessionToken)}
          />
        )}
      </For>
      <IconButton
        {...ACTION_PROPS}
        icon="i-lucide:user-plus"
        label="Add account"
        disabled={pending()}
        link={appendRedirectTo("/auth/sign-in", location.pathname, true)}
      />
      <IconButton
        {...ACTION_PROPS}
        icon="i-lucide:log-out"
        label="Log out"
        disabled={pending()}
        onClick={logOut}
      />
    </div>
  );
};

export { AccountOptions };
