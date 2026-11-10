import { createSignal } from "solid-js";
import type { CollectionAccess } from "#web/lib/api";
import type { SessionInfo, WorkspaceInfo } from "#web/context/workspace";

interface OfflineWorkspaceAccess {
  accessByCollectionID: Record<string, CollectionAccess>;
  blockedCollectionIDs: string[];
}
interface OfflineState {
  requiresSignIn?: boolean;
  user: SessionInfo["user"];
  workspaceID: string;
  workspaces: WorkspaceInfo[];
  access: Record<string, OfflineWorkspaceAccess>;
}

const OFFLINE_STATE_KEY = "andesine:offline";
const [isOffline, setOffline] = createSignal(
  typeof window !== "undefined" && document.documentElement.hasAttribute("data-offline-shell")
);

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => setOffline(true));
  window.addEventListener("online", () => setOffline(false));
}

const readOfflineState = (includeLocked = false): OfflineState | null => {
  if (typeof window === "undefined") return null;

  try {
    const state = JSON.parse(
      localStorage.getItem(OFFLINE_STATE_KEY) || "null"
    ) as OfflineState | null;

    if (
      !state?.user?.id ||
      !state.workspaceID ||
      !Array.isArray(state.workspaces) ||
      !state.access ||
      (state.requiresSignIn && !includeLocked)
    ) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
};
const writeOfflineState = (state: OfflineState): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(OFFLINE_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save offline workspace information", error);
  }
};
const lockOfflineState = (): void => {
  const state = readOfflineState(true);

  if (state) writeOfflineState({ ...state, requiresSignIn: true });
};
const saveOfflineWorkspace = (
  user: SessionInfo["user"],
  workspaceID: string,
  workspaces: WorkspaceInfo[]
): void => {
  const previous = readOfflineState(true);
  const availableWorkspaces = workspaces.filter((workspace) => workspace.userID === user.id);
  const availableIDs = new Set(availableWorkspaces.map((workspace) => workspace.id));

  writeOfflineState({
    user: { id: user.id, name: user.name, email: user.email },
    workspaceID,
    workspaces: availableWorkspaces,
    access:
      previous?.user.id === user.id
        ? Object.fromEntries(Object.entries(previous.access).filter(([id]) => availableIDs.has(id)))
        : {}
  });
};
const saveOfflineAccess = (
  workspaceID: string,
  userID: string,
  access: OfflineWorkspaceAccess
): void => {
  const state = readOfflineState();

  if (
    state?.user.id !== userID ||
    !state.workspaces.some((workspace) => workspace.id === workspaceID)
  )
    return;

  writeOfflineState({ ...state, access: { ...state.access, [workspaceID]: access } });
};
const clearOfflineState = (persist: string[] = [], userID?: string): void => {
  const state = readOfflineState(true);

  if (!state || (userID && state.user.id !== userID)) return;

  const workspaces = state.workspaces.filter((workspace) => persist.includes(workspace.id));

  if (!workspaces.length) {
    localStorage.removeItem(OFFLINE_STATE_KEY);
    return;
  }

  writeOfflineState({
    ...state,
    workspaceID: persist.includes(state.workspaceID) ? state.workspaceID : workspaces[0].id,
    workspaces,
    access: Object.fromEntries(Object.entries(state.access).filter(([id]) => persist.includes(id)))
  });
};

export {
  isOffline,
  setOffline,
  readOfflineState,
  saveOfflineWorkspace,
  saveOfflineAccess,
  clearOfflineState,
  lockOfflineState
};
