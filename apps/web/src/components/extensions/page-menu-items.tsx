import { type MenuItem } from "@andesine/components";
import {
  getAvailablePagePath,
  getExtensionPages,
  resolvePageContext,
  type RunningExtension
} from "#web/lib/extensions";
import { useNavigate, useParams } from "@solidjs/router";
import { ScopedIcon } from "./scoped-icon";

/**
 * Menu items that open the extension pages of a collection or an entry: one item for each
 * extension, named after it, that opens its available page, or a submenu of them.
 */
const useExtensionPageItems = (context: "collection" | "entry") => {
  const navigate = useNavigate();
  const params = useParams<{ workspaceID?: string }>();
  const getItems = (id: string): MenuItem[] => {
    const workspaceID = params.workspaceID;
    const ids = resolvePageContext(
      context === "collection" ? { collectionID: id } : { entryID: id }
    );
    const itemsByExtension = new Map<RunningExtension, MenuItem[]>();

    if (!workspaceID) return [];

    for (const { extension, page } of getExtensionPages(context)) {
      const path = getAvailablePagePath(workspaceID, extension.extensionID, page, ids);

      if (!path) continue;

      itemsByExtension.set(extension, [
        ...(itemsByExtension.get(extension) ?? []),
        {
          label: page.name,
          icon: () => <ScopedIcon extension={extension.name} icon={page.icon} />,
          onClick: () => navigate(path)
        }
      ]);
    }

    return [...itemsByExtension].map(([extension, items]) => {
      const icon = extension.icon
        ? () => <ScopedIcon extension={extension.name} icon={extension.icon!} />
        : items[0]!.icon;

      return items.length === 1
        ? { ...items[0]!, label: extension.displayName, icon }
        : { label: extension.displayName, icon, items };
    });
  };
  return { getItems };
};

export { useExtensionPageItems };
