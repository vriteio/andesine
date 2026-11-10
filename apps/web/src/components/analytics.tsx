import { useLocation } from "@solidjs/router";
import { type Component, createEffect, createMemo, on, onCleanup, onMount } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import {
  capturePageview,
  identifiedWorkspaceID,
  identifyAnalytics,
  initAnalytics
} from "#web/lib/analytics";
import { validateWorkspaceID } from "#web/lib/validation";

const IDENTIFY_TIMEOUT_MS = 10_000;

const Analytics: Component = () => {
  const location = useLocation();

  let capturedPathname: string | undefined;

  const capture = (pathname: string) => {
    if (pathname === capturedPathname) return;

    capturedPathname = pathname;
    capturePageview();
  };

  onMount(initAnalytics);
  createEffect(
    on([() => location.pathname, identifiedWorkspaceID], ([pathname, workspaceID]) => {
      const pathWorkspaceID = pathname.split("/")[1] ?? "";
      // Workspace pages wait for their workspace, so views get the user and the right group.
      const waitsForWorkspace =
        validateWorkspaceID(pathWorkspaceID) && workspaceID !== pathWorkspaceID;

      if (!waitsForWorkspace) {
        capture(pathname);

        return;
      }

      // Workspaces that fail to load still get their view.
      const timeout = setTimeout(() => capture(pathname), IDENTIFY_TIMEOUT_MS);

      onCleanup(() => clearTimeout(timeout));
    })
  );

  return null;
};
const WorkspaceAnalytics: Component = () => {
  const { currentSession, currentWorkspace } = useWorkspace();
  // Memos, so refetched objects with the same values don't identify again.
  const userID = createMemo(() => currentSession()?.user.id);
  const userName = createMemo(() => currentSession()?.user.name ?? "");
  const userEmail = createMemo(() => currentSession()?.user.email ?? "");
  const workspaceID = createMemo(() => currentWorkspace()?.id);
  const workspaceName = createMemo(() => currentWorkspace()?.name ?? "");

  createEffect(() => {
    const id = userID();
    const currentWorkspaceID = workspaceID();

    if (!id || !currentWorkspaceID) return;

    identifyAnalytics(
      { id, name: userName(), email: userEmail() },
      { id: currentWorkspaceID, name: workspaceName() }
    );
  });

  return null;
};

export { Analytics, WorkspaceAnalytics };
