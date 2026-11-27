import {
  type ExtensionActiveView,
  type ExtensionConfigurationState,
  type ExtensionRuntime
} from "@andesine/contracts/extensions";
import { withAuthorization } from "#backend/lib/policy";
import { resolveVisitorEntry, type VisitorEntry } from "#backend/lib/shares";
import { Extensions } from "#backend/services/extensions";

interface SharedExtensions {
  runtime: ExtensionRuntime[];
  activeViews: ExtensionActiveView[];
  configurations: Record<string, ExtensionConfigurationState["values"]>;
}

/** Registry extensions, without backend or granted permissions. */
const listShareExtensions = withAuthorization<object, VisitorEntry, SharedExtensions>(
  {
    actions: ({ resolved }) => ({ entries: [{ action: "entry:read", ...resolved }] }),
    resolve: async ({ auth }) => resolveVisitorEntry(auth)
  },
  async ({ auth, authorizationScope }) => {
    const [runtime, activeViews] = await Promise.all([
      Extensions.listRuntime({ auth, skipAuthorization: authorizationScope }),
      Extensions.listActiveViews({ auth, skipAuthorization: authorizationScope })
    ]);

    // Only for the extensions whose element views run on the page.
    const viewExtensionIDs = new Set(activeViews.map(({ extensionID }) => extensionID));
    const configurations = await Promise.all(
      runtime
        .filter(({ id }) => viewExtensionIDs.has(id))
        .map(async ({ id }) => {
          const { values } = await Extensions.getConfiguration({
            auth,
            extensionID: id,
            skipAuthorization: authorizationScope
          });

          return [id, values] as const;
        })
    );

    return {
      configurations: Object.fromEntries(configurations),
      runtime: runtime.map((extension) => ({
        ...extension,
        grant: { ...extension.grant, permissions: [], backendURL: null }
      })),
      activeViews
    };
  }
);

export { listShareExtensions };
