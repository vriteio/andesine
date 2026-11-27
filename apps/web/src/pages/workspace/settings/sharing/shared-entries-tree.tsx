import { type Component, createMemo, Show } from "solid-js";
import { PAGE_TREE_SIZE, Tree, TREE_ROOT_ID, type TreeMap } from "#web/components/tree";
import { type SharedEntry } from "#web/lib/data";
import { SharedEntryItem } from "./shared-entry-item";

interface SharedEntriesTreeProps {
  entries: SharedEntry[];
  onOpenEntry(entryID: string): void;
  onOpenSharing(entry: SharedEntry): void;
  onRemove(entries: SharedEntry[]): void;
}

const SharedEntriesTree: Component<SharedEntriesTreeProps> = (props) => {
  const entries = createMemo(() => new Map(props.entries.map((entry) => [entry.id, entry])));
  const treeMap = createMemo<TreeMap>(() => ({
    [TREE_ROOT_ID]: { items: props.entries.map(({ id }) => id), levels: [] }
  }));
  const getEntries = (ids: string[]) => ids.flatMap((id) => entries().get(id) || []);

  return (
    <Tree
      keyboard
      tree={treeMap}
      {...PAGE_TREE_SIZE}
      renderItem={(id) => (
        <Show when={entries().get(id)}>
          {(entry) => (
            <SharedEntryItem
              entry={entry()}
              getEntries={getEntries}
              onOpenEntry={() => props.onOpenEntry(id)}
              onOpenSharing={() => props.onOpenSharing(entry())}
              onRemove={props.onRemove}
            />
          )}
        </Show>
      )}
    />
  );
};

export { SharedEntriesTree };
