import { createMemo, type ParentComponent } from "solid-js";
import { useParams } from "@solidjs/router";
import { TREE_ROOT_ID, TreeProvider, type TreeMap, useTree } from "#web/components/tree";
import { getRequestEvent } from "solid-js/web";
import { useWorkspace } from "#web/context/workspace";
import { usePublishing } from "#web/context/publishing";
import { sortExplorerCollectionIDs } from "./sort-collections";
import { sortExplorerEntryIDs } from "./sort-entries";

const EXPLORER_STATE_COOKIE = "explorer-state";

const readCookieValue = (cookieHeader: string, name: string) => {
  const prefix = `${name}=`;

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
};

const parseExpandedCookie = (value: string | undefined | null) => {
  if (!value) {
    return {} as Record<string, string[]>;
  }

  try {
    const parsedValue = JSON.parse(decodeURIComponent(value));

    if (!parsedValue || typeof parsedValue !== "object") {
      return {} as Record<string, string[]>;
    }

    return Object.fromEntries(
      Object.entries(parsedValue).map(([workspaceID, expanded]) => [
        workspaceID,
        Array.isArray(expanded)
          ? expanded.filter((value): value is string => typeof value === "string")
          : []
      ])
    ) as Record<string, string[]>;
  } catch {
    return {} as Record<string, string[]>;
  }
};

const readExplorerStateCookie = () => {
  const event = getRequestEvent();

  if (event) {
    return parseExpandedCookie(
      readCookieValue(event.request.headers.get("cookie") || "", EXPLORER_STATE_COOKIE)
    );
  }

  if (typeof document === "undefined") {
    return {} as Record<string, string[]>;
  }

  const cookieValue = readCookieValue(document.cookie, EXPLORER_STATE_COOKIE);

  return parseExpandedCookie(cookieValue);
};

const ExplorerProvider: ParentComponent = (props) => {
  const { content } = useWorkspace();
  const publishing = usePublishing();
  const params = useParams<{ workspaceID?: string }>();
  const currentWorkspaceID = () => params.workspaceID || null;
  const expandedSourceKey = currentWorkspaceID;
  const initialExpanded = () => {
    const workspaceID = currentWorkspaceID();

    if (!workspaceID) {
      return [] as string[];
    }

    return readExplorerStateCookie()[workspaceID] ?? [];
  };
  const persistExpanded = (expanded: string[]) => {
    if (typeof document === "undefined") {
      return;
    }

    const workspaceID = currentWorkspaceID();

    if (!workspaceID) {
      return;
    }

    const nextExpandedState = readExplorerStateCookie();

    if (expanded.length > 0) {
      nextExpandedState[workspaceID] = expanded;
    } else {
      delete nextExpandedState[workspaceID];
    }

    document.cookie = `${EXPLORER_STATE_COOKIE}=${encodeURIComponent(
      JSON.stringify(nextExpandedState)
    )}; path=/; SameSite=Lax`;
  };
  const levelIDs = createMemo(() => {
    return {
      ...content.collections.getIDs(),
      ...Object.fromEntries(
        publishing.getCollectionOverlays().map((collection) => [collection.collectionID, true])
      ),
      ...Object.fromEntries(
        [...content.pendingPublishingCollectionOverlays().keys()].map((collectionID) => [
          collectionID,
          true
        ])
      )
    };
  });
  const tree = createMemo<TreeMap>(() => {
    const workingTree = content.tree.getMap();
    const nextTree = Object.fromEntries(
      Object.entries(workingTree).map(([levelID, level]) => {
        const collectionID = levelID === TREE_ROOT_ID ? null : levelID;
        const collectionOverlays = publishing.getCollectionOverlaysInParent(collectionID);
        const pendingCollectionOverlays =
          publishing.getPendingCollectionOverlaysInParent(collectionID);
        const entryOverlays = publishing.getEntryOverlaysInCollection(collectionID);
        const pendingEntryOverlays = publishing.getPendingEntryOverlaysInCollection(collectionID);
        const workingEntries = level.items.flatMap((entryID) => {
          const entry = content.entries.get({ entryID });

          return entry ? [entry] : [];
        });
        const items = sortExplorerEntryIDs({
          entryOverlays,
          pendingEntryOverlays,
          workingEntries
        });
        const levels = sortExplorerCollectionIDs({
          collectionOverlays,
          pendingCollectionOverlays,
          workingCollectionIDs: level.levels
        });

        return [levelID, { items, levels }];
      })
    );

    for (const collection of publishing.getCollectionOverlays()) {
      const collectionOverlays = publishing.getCollectionOverlaysInParent(collection.collectionID);
      const entryOverlays = publishing.getEntryOverlaysInCollection(collection.collectionID);
      const pendingEntryOverlays = publishing.getPendingEntryOverlaysInCollection(
        collection.collectionID
      );

      nextTree[collection.collectionID] = {
        items: sortExplorerEntryIDs({
          entryOverlays,
          pendingEntryOverlays,
          workingEntries: []
        }),
        levels: sortExplorerCollectionIDs({
          collectionOverlays,
          workingCollectionIDs: []
        })
      };
    }

    for (const collection of content.pendingPublishingCollectionOverlays().values()) {
      const collectionOverlays = publishing.getCollectionOverlaysInParent(collection.collectionID);
      const pendingCollectionOverlays = publishing.getPendingCollectionOverlaysInParent(
        collection.collectionID
      );
      const entryOverlays = publishing.getEntryOverlaysInCollection(collection.collectionID);
      const pendingEntryOverlays = publishing.getPendingEntryOverlaysInCollection(
        collection.collectionID
      );

      nextTree[collection.collectionID] = {
        items: sortExplorerEntryIDs({
          entryOverlays,
          pendingEntryOverlays,
          workingEntries: []
        }),
        levels: sortExplorerCollectionIDs({
          collectionOverlays,
          pendingCollectionOverlays,
          workingCollectionIDs: []
        })
      };
    }

    return nextTree;
  });

  return (
    <TreeProvider
      tree={tree}
      levelIDs={levelIDs}
      initialExpanded={initialExpanded}
      expandedSourceKey={expandedSourceKey}
      persistExpandedReady={() => !content.loading() && !publishing.explorerOverlayLoading()}
      onExpandedChange={persistExpanded}
    >
      {props.children}
    </TreeProvider>
  );
};
const useExplorer = useTree;

export { ExplorerProvider, useExplorer };
