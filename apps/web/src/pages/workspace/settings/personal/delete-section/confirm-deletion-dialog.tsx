import { Dialog } from "@andesine/components";
import { type Component, createEffect, createSignal, Show } from "solid-js";
import { createAsync, revalidate, useNavigate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { ORPCError } from "@orpc/client";
import { ActionConfirmationContent } from "#web/components/action-confirmation-dialog";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { clearPersistenceData } from "#web/context/workspace/indexeddb";
import { pauseAnalytics } from "#web/lib/analytics";
import { authClient, client } from "#web/lib/api";
import { isSessionNotFreshError, soleAdminWorkspacesQuery } from "#web/lib/data";
import { ConfirmDeletionContent } from "../../confirm-deletion-dialog";
import { useSettings } from "../../settings-context";

interface AccountDeletionDialogProps {
  opened: boolean;
  onClose(): void;
}

type DeletedWorkspaces = Awaited<ReturnType<typeof soleAdminWorkspacesQuery>>;

// A conflict means another tab switched the account; its message says to reload.
const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof ORPCError && error.code === "CONFLICT" ? error.message : fallback;
};

const AccountDeletionDialog: Component<AccountDeletionDialogProps> = (props) => {
  const notify = useNotify();
  const navigate = useNavigate();
  const { openVerificationDialog } = useSettings();
  const { currentSession, currentWorkspace, refreshWorkspaces, sessions, workspaces } =
    useWorkspace();
  const [reviewing, setReviewing] = createSignal(false);
  // An initial value keeps reads from suspending the settings page; null means not loaded.
  const deletedWorkspaces = createAsync<DeletedWorkspaces | null>(
    async (displayedWorkspaces) => {
      const userID = currentSession()?.user.id;

      // The closed dialog keeps the list displayed until its exit animation ends.
      if (!props.opened) return displayedWorkspaces;
      if (!userID) return null;

      try {
        return await soleAdminWorkspacesQuery(userID);
      } catch (error) {
        console.error(error);
        notify({
          type: "error",
          text: getErrorMessage(error, "Failed to load the workspaces to delete")
        });

        return null;
      }
    },
    { initialValue: null }
  );
  const deleteAccountMutation = createMutation(() => ({
    mutationFn: async (userID: string) => {
      // Data that PostHog gets after the request isn't erased, so capture pauses first.
      const resumeAnalytics = await pauseAnalytics();

      try {
        await client.auth.deleteAccount({ userID });
      } catch (error) {
        // A lost response can hide a finished deletion; a missing session shows it.
        const { data, error: sessionError } = await authClient.getSession();

        if (!sessionError && !data) return;

        resumeAnalytics();
        throw error;
      }
    },
    onError: async (error, userID) => {
      const workspaceID = currentWorkspace()?.id;

      if (isSessionNotFreshError(error)) {
        openVerificationDialog(() => deleteAccountMutation.mutate(userID));

        return;
      }

      console.error(error);
      if (reviewing()) props.onClose();

      notify({
        type: "error",
        text: getErrorMessage(error, "Failed to delete account. Some workspaces may be deleted.")
      });
      await Promise.allSettled([refreshWorkspaces(), revalidate(soleAdminWorkspacesQuery.key)]);

      // The open workspace may be one of those deleted before the error.
      if (!workspaces().some(({ id }) => id === workspaceID)) navigate("/");
    },
    onSuccess: async (_, userID) => {
      const otherSession = sessions().find(({ user }) => user.id !== userID);
      const otherWorkspace = workspaces().find(
        (workspace) => otherSession && workspace.userID === otherSession.user.id
      );

      await clearPersistenceData({ userID });

      if (otherSession) {
        await authClient.multiSession.setActive({ sessionToken: otherSession.sessionToken });
        window.location.href = otherWorkspace ? `/${otherWorkspace.id}/` : "/new-workspace";

        return;
      }

      // The deleted session is gone, so this only clears the cookie.
      await authClient.signOut();
      window.location.href = "/auth/sign-in";
    }
  }));
  const deleteAccount = () => {
    const userID = currentSession()?.user.id;

    if (userID) deleteAccountMutation.mutate(userID);
  };
  const close = () => {
    if (!deleteAccountMutation.isPending) props.onClose();
  };
  const confirm = () => {
    if (deletedWorkspaces.latest?.length) {
      setReviewing(true);
      return;
    }

    deleteAccount();
  };

  createEffect(() => {
    if (props.opened) setReviewing(false);
  });

  return (
    <Dialog
      opened={props.opened}
      onOverlayClick={close}
      aria-label={reviewing() ? "Delete these workspaces too?" : "Delete account"}
    >
      <Show
        when={reviewing()}
        fallback={
          <ConfirmDeletionContent
            opened={props.opened}
            label="Delete account"
            description="Your account and all workspaces where you're the only admin will be permanently deleted, and their subscriptions cancelled. This cannot be undone."
            confirmation={currentSession()?.user.email ?? ""}
            pending={deleteAccountMutation.isPending}
            ready={Boolean(deletedWorkspaces.latest)}
            onConfirm={confirm}
            onClose={close}
          />
        }
      >
        <ActionConfirmationContent
          title="Delete these workspaces too?"
          description="You're the only admin of these workspaces, so they will be deleted for all their members."
          affected={(deletedWorkspaces.latest ?? []).map((workspace) => ({
            id: workspace.id,
            icon: "i-lucide:hexagon",
            label: workspace.name
          }))}
          warning="To keep a workspace, make another member an admin first."
          action={{
            color: "danger",
            label: "Delete account and workspaces",
            loading: deleteAccountMutation.isPending,
            onClick: deleteAccount
          }}
          onClose={close}
        />
      </Show>
    </Dialog>
  );
};

export { AccountDeletionDialog };
