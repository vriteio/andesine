import { type Component } from "solid-js";
import { createMutation } from "@tanstack/solid-query";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { ConfirmDeletionDialog } from "../../confirm-deletion-dialog";

interface WorkspaceDeletionDialogProps {
  opened: boolean;
  onClose(): void;
}

const WorkspaceDeletionDialog: Component<WorkspaceDeletionDialogProps> = (props) => {
  const notify = useNotify();
  const { content, currentWorkspace, refreshWorkspaces, switchWorkspace, workspaces } =
    useWorkspace();
  const deleteWorkspaceMutation = createMutation(() => ({
    mutationFn: async () => {
      const workspace = currentWorkspace();

      if (!workspace) throw new Error("Workspace not found");

      return {
        deletedWorkspaceID: workspace.id,
        result: await client.workspaces.delete()
      };
    },
    onError: (error) => {
      console.error(error);
      notify({
        type: "error",
        text: "Failed to delete workspace. No local data was removed."
      });
    },
    onSuccess: async ({ deletedWorkspaceID, result }) => {
      await Promise.allSettled([
        content.disposeWorkspaceContent(deletedWorkspaceID),
        refreshWorkspaces()
      ]);

      if (result.workspaceID) {
        window.location.href = `/${result.workspaceID}/`;
        return;
      }

      const remainingWorkspace = workspaces().find(({ id }) => id !== deletedWorkspaceID);

      if (remainingWorkspace) {
        await switchWorkspace(remainingWorkspace.id);
        return;
      }

      window.location.href = "/new-workspace";
    }
  }));

  return (
    <ConfirmDeletionDialog
      opened={props.opened}
      label="Delete workspace"
      description="All workspace data will be permanently deleted and any active subscription cancelled. This cannot be undone."
      confirmation={currentWorkspace()?.name ?? ""}
      pending={deleteWorkspaceMutation.isPending}
      onConfirm={() => deleteWorkspaceMutation.mutate()}
      onClose={props.onClose}
    />
  );
};

export { WorkspaceDeletionDialog };
