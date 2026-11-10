import type { LinkInputEntry } from "@andesine/components";
import type { EditorLinks } from "@andesine/editor";
import { useNavigate } from "@solidjs/router";
import { createMemo } from "solid-js";
import { TREE_ROOT_ID } from "#web/components/tree";
import { useWorkspace } from "#web/context/workspace";

/**
 * The workspace's entries to link to, from its local content tree, with their collections' path;
 * only those in a collection, at any depth, when `rootID` is given.
 */
const useLinkEntries = (rootID?: () => string | undefined) => {
  const { content } = useWorkspace();

  return createMemo((): LinkInputEntry[] => {
    const collections = content.collectionsCollection().find().fetch();
    const root = rootID?.();
    const included = new Set(
      collections.flatMap(({ id, ancestors }) => {
        return !root || id === root || ancestors.includes(root) ? [id] : [];
      })
    );
    const names = new Map(collections.map(({ id, name }) => [id, name]));
    const paths = new Map(
      collections.map(({ id, ancestors }) => {
        const ids = [...ancestors, id].filter((collectionID) => collectionID !== TREE_ROOT_ID);

        return [id, ids.flatMap((collectionID) => names.get(collectionID) ?? []).join(" / ")];
      })
    );

    return content
      .entriesCollection()
      .find()
      .fetch()
      .filter((entry) => !root || (entry.collectionID && included.has(entry.collectionID)))
      .map(({ id, name, collectionID }) => {
        return { id, title: name, path: (collectionID && paths.get(collectionID)) || "" };
      });
  });
};
/**
 * Links to the workspace's entries, from its local content tree: the editor's link menu, entry
 * link titles, and opening them.
 */
const useEditorLinks = (workspaceID: () => string): EditorLinks => {
  const navigate = useNavigate();
  const entries = useLinkEntries();

  return {
    entries,
    openEntry: (entryID, newTab) => {
      const path = `/${workspaceID()}/${entryID}`;

      if (newTab) {
        window.open(path, "_blank", "noopener");
      } else {
        navigate(path);
      }
    },
    getEntryURL: (entryID) => `${window.location.origin}/${workspaceID()}/${entryID}`,
    // Only this app's entry URLs in the workspace, e.g. https://…/ws_…/ent_…#setup.
    toEntryLink: (value) => {
      try {
        const url = new URL(value);
        const [urlWorkspaceID, entryID, ...rest] = url.pathname.split("/").filter(Boolean);
        const isEntryURL =
          url.origin === window.location.origin &&
          urlWorkspaceID === workspaceID() &&
          entryID?.startsWith("ent_") &&
          !rest.length;

        return isEntryURL ? `entry:${entryID}${url.hash}` : null;
      } catch {
        return null;
      }
    }
  };
};

export { useEditorLinks, useLinkEntries };
