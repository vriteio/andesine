import { type ExtensionPage } from "@andesine/contracts/extensions";

interface ExtensionPageContext {
  collectionID?: string;
  entryID?: string;
}

/** The page's route, with the context ID that its context needs; null when it's missing. */
const getExtensionPagePath = (
  workspaceID: string,
  extensionID: string,
  page: ExtensionPage,
  context: ExtensionPageContext = {}
): string | null => {
  const query = new URLSearchParams();

  if (page.context === "collection") {
    if (!context.collectionID?.startsWith("coll_")) return null;

    query.set("collectionID", context.collectionID);
  }

  if (page.context === "entry") {
    if (!context.entryID?.startsWith("ent_")) return null;

    query.set("entryID", context.entryID);
  }

  const search = query.size ? `?${query}` : "";

  return `/${workspaceID}/extensions/${extensionID}/${page.id}${search}`;
};

export { getExtensionPagePath };
export type { ExtensionPageContext };
