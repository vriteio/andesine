import { useParams, useSearchParams } from "@solidjs/router";
import { usePublishing } from "#web/context/publishing";
import { useWorkspace } from "#web/context/workspace";

interface PanelContext {
  entryID?: string;
  collectionID?: string;
}

/**
 * The entry and the collection that the right side panels are for: the open entry and its
 * collection, the open collection page (e.g. its access control), or an extension page's.
 */
const usePanelContext = () => {
  const params = useParams<{ slug?: string; pageID?: string }>();
  const [searchParams] = useSearchParams<{ collectionID?: string; entryID?: string }>();
  const { content } = useWorkspace();

  return (): PanelContext => {
    const pageContext = params.pageID ? searchParams : {};
    const entry = content.entries.get({ entryID: params.slug || pageContext.entryID || "" });

    if (entry) return { entryID: entry.id, collectionID: entry.collectionID || undefined };
    if (params.slug?.startsWith("coll_")) return { collectionID: params.slug };

    return { collectionID: pageContext.collectionID };
  };
};

/**
 * Whether the content tree and publishing state loaded, so that publishing collections are known.
 * Not `content.loading()`: it ends with the local cache, before the tree's publishing state.
 */
const usePublishingResolved = () => {
  const { content } = useWorkspace();
  const publishing = usePublishing();

  return () => {
    return (
      content.offline() ||
      (!content.accessLoading() &&
        !publishing.statusLoading() &&
        !publishing.explorerOverlayLoading())
    );
  };
};

export { usePanelContext, usePublishingResolved };
export type { PanelContext };
