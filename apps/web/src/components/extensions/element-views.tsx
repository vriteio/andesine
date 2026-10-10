import {
  type ElementViewMount,
  type ElementViewRenderer,
  type ElementViews
} from "@andesine/editor";
import { useWorkspace } from "#web/context/workspace";
import { extensionActiveViewsQuery } from "#web/lib/data";
import {
  createRootFinder,
  matchElementView,
  runningExtensions,
  type RunningExtension
} from "#web/lib/extensions";
import { createAsync, revalidate } from "@solidjs/router";
import { createEffect, createRoot, getOwner, on, onCleanup } from "solid-js";
import { insert } from "solid-js/web";
import { ExtensionView } from "./extension-view";
import { ScopedIcon } from "./scoped-icon";
import { ContentSlotContext } from "./host-components";

type ViewProps = NonNullable<Parameters<RunningExtension["host"]["createView"]>[1]>;

const mountView = (
  extension: RunningExtension,
  entry: string,
  mount: ElementViewMount,
  owner: ReturnType<typeof getOwner>
): (() => void) => {
  return createRoot((dispose) => {
    const viewProps = () => ({ element: mount.name(), props: mount.props() }) as ViewProps;
    const viewID = extension.host.createView(entry, viewProps());
    const slot = { contentDOM: mount.contentDOM, parking: mount.parking, owner: null };
    const offViewError = extension.onViewError(viewID, mount.fallback);

    extension.host.setViewTarget(viewID, { setElementProps: mount.setProps });

    createEffect(
      on(viewProps, (props) => extension.host.updateView(viewID, props), { defer: true })
    );
    insert(mount.container, () => (
      <ContentSlotContext.Provider value={slot}>
        <ExtensionView host={extension.host} viewID={viewID} />
      </ContentSlotContext.Provider>
    ));
    onCleanup(() => {
      offViewError();
      extension.host.disposeView(viewID);
    });

    return dispose;
  }, owner);
};
/** Element views of running extensions; create it in a component to keep the app's context. */
const createElementViews = (): ElementViews => {
  const owner = getOwner();
  const { workspaceID, subscribeToUpdates } = useWorkspace();
  const activeViews = createAsync(async () => {
    const id = workspaceID();

    return id ? extensionActiveViewsQuery(id) : [];
  });
  const renderers = new WeakMap<RunningExtension, Map<string, ElementViewRenderer>>();
  const getRenderer = (extension: RunningExtension, entry: string): ElementViewRenderer => {
    const byEntry = renderers.get(extension) ?? new Map<string, ElementViewRenderer>();
    const renderer = byEntry.get(entry) ?? {
      mount: (mount) => mountView(extension, entry, mount, owner)
    };

    byEntry.set(entry, renderer);
    renderers.set(extension, byEntry);

    return renderer;
  };
  onCleanup(
    subscribeToUpdates((event) => {
      if (event.action.startsWith("extension:")) void revalidate(extensionActiveViewsQuery.key);
    })
  );

  const getSources = () => {
    return runningExtensions()
      .filter((extension) => extension.status() === "ready")
      .map((extension) => ({
        extension,
        extensionID: extension.extensionID,
        views: extension.elementViews
      }));
  };

  return {
    resolve(name, ancestors) {
      const match = matchElementView(
        createRootFinder(getSources(), activeViews() ?? []),
        name,
        ancestors
      );

      return match ? getRenderer(match.extension, match.entry) : null;
    },
    list() {
      const findRoot = createRootFinder(getSources(), activeViews() ?? []);

      return (activeViews() ?? []).flatMap(({ selector }) => {
        const root = findRoot(selector);

        if (!root) return [];

        const { extension, view } = root;

        return [
          {
            element: view.element,
            label: view.name,
            description: view.description,
            icon: view.icon && (() => <ScopedIcon extension={extension.name} icon={view.icon!} />),
            // Views with descendant views render content.
            selfClosing: !view.descendants.length
          }
        ];
      });
    }
  };
};

export { createElementViews };
