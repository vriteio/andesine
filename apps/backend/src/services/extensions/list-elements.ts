import { type ExtensionElement, type ExtensionElementView } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { toElementViews } from "#backend/lib/extensions/catalog";
import { listInstalledExtensions } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { inArray } from "drizzle-orm";
import { listActiveViews } from "./list-active-views";

type ElementChild = ExtensionElementView["children"][number];

const toChild = (child: ElementChild): ExtensionElement["children"][number] => ({
  element: child.element,
  name: child.name,
  description: child.description,
  content: child.content ?? true,
  accepts: child.accepts,
  rejects: child.rejects,
  props: child.props
});
/** The custom elements of the active element views, e.g. for MCP clients that write MDX. */
const listElements = withAuthorization<Record<never, never>, undefined, ExtensionElement[]>(
  { permissions: { session: true, key: ["read:entries"] } },
  async ({ auth }) => {
    const views = await listActiveViews({ auth });
    const installed = views.length
      ? await listInstalledExtensions(
          db,
          inArray(
            extensions.id,
            views.map(({ extensionID }) => toUUID(extensionID))
          )
        )
      : [];

    return views.flatMap(({ extensionID, viewID }) => {
      const found = installed.find(({ extension }) => extension.id === toUUID(extensionID));
      const view = found && toElementViews(found.version.manifest).find(({ id }) => id === viewID);

      if (!found || !view) return [];

      return [
        {
          element: view.element,
          name: view.name,
          description: view.description,
          extension: found.version.manifest.name,
          content: view.content ?? view.children.length > 0,
          accepts: view.accepts,
          rejects: view.rejects,
          props: view.props,
          children: view.children.map(toChild)
        }
      ];
    });
  }
);

export { listElements };
