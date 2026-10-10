import { useWorkspace } from "#web/context/workspace";
import { notifyExtensionUpdate, setExtensionMember } from "#web/lib/extensions";
import { type Component, onCleanup } from "solid-js";

/** Provides the current member's authority to running extensions. */
const ExtensionMember: Component = () => {
  const { currentWorkspace, subscribeToUpdates } = useWorkspace();

  onCleanup(
    setExtensionMember(() => {
      const workspace = currentWorkspace();

      return workspace
        ? { workspaceID: workspace.id, admin: workspace.admin, permissions: workspace.permissions }
        : null;
    })
  );
  onCleanup(
    subscribeToUpdates((event) => {
      if (event.action === "extension:update") notifyExtensionUpdate(event.data.id);
    })
  );

  return null;
};

export { ExtensionMember };
