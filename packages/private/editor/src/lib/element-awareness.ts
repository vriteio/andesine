import type { HocuspocusProvider } from "@hocuspocus/provider";
import { untrack } from "solid-js";

interface ElementEditorPresence {
  name: string;
  color: string;
  source?: string;
}

const createElementAwareness = (
  awareness: HocuspocusProvider["awareness"],
  getID: () => unknown,
  user: () => { name: string; color: string }
) => ({
  getRemote(): ElementEditorPresence | null {
    const id = getID();

    if (!awareness || typeof id !== "string") return null;

    for (const [clientID, state] of awareness.getStates()) {
      const editing = state.elementEditing;

      if (clientID === awareness.clientID || editing?.id !== id) continue;

      return {
        name: String(editing.name || "Another user"),
        color: String(editing.color || "#f59e0b"),
        source: typeof editing.source === "string" ? editing.source : undefined
      };
    }
    return null;
  },
  publish(source: string): void {
    const id = getID();

    if (typeof id === "string") {
      awareness?.setLocalStateField("elementEditing", { id, ...untrack(user), source });
    }
  },
  release(): void {
    if (awareness && awareness.getLocalState()?.elementEditing?.id === getID()) {
      awareness.setLocalStateField("elementEditing", null);
    }
  }
});

export { createElementAwareness };
