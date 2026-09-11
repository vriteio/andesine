import type { HocuspocusProvider } from "@hocuspocus/provider";
import { untrack } from "solid-js";

interface ElementEditorPresence {
  clientID: number;
  name: string;
  color: string;
  source?: string;
  selection?: ElementTagSelection;
}

interface ElementTagSelection {
  anchor: number;
  head: number;
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
      const selection = editing?.selection;

      if (clientID === awareness.clientID || editing?.id !== id) continue;

      return {
        clientID,
        name: String(editing.name || "Another user"),
        color: String(editing.color || "#f59e0b"),
        source: typeof editing.source === "string" ? editing.source : undefined,
        selection:
          Number.isSafeInteger(selection?.anchor) && Number.isSafeInteger(selection?.head)
            ? { anchor: selection.anchor, head: selection.head }
            : undefined
      };
    }
    return null;
  },
  publish(source: string, selection?: ElementTagSelection): void {
    const id = getID();

    if (typeof id === "string") {
      awareness?.setLocalStateField("elementEditing", { id, ...untrack(user), source, selection });
    }
  },
  release(): void {
    if (awareness && awareness.getLocalState()?.elementEditing?.id === getID()) {
      awareness.setLocalStateField("elementEditing", null);
    }
  }
});

export { createElementAwareness };
export type { ElementEditorPresence, ElementTagSelection };
