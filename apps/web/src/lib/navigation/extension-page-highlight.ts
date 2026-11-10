import { useParams, useSearchParams } from "@solidjs/router";
import { findExtensionPage } from "#web/lib/extensions";

/** The collection or entry ID that the open extension page marks in the explorer, if it opts in. */
const useExtensionPageHighlight = () => {
  const params = useParams<{ extensionID?: string; pageID?: string }>();
  const [searchParams] = useSearchParams<{ collectionID?: string; entryID?: string }>();

  return (): string | null => {
    const found =
      params.extensionID && params.pageID
        ? findExtensionPage(params.extensionID, params.pageID)
        : null;
    const page = found?.page;
    const parent = page?.parent && found?.extension.pages.find(({ id }) => id === page.parent);
    // A sub-page marks what its parent marks, unless it sets its own.
    const highlights = page?.highlightContext ?? (parent || null)?.highlightContext;

    if (!page || !highlights) return null;
    if (page.context === "collection") return searchParams.collectionID ?? null;

    return page.context === "entry" ? (searchParams.entryID ?? null) : null;
  };
};

export { useExtensionPageHighlight };
