import { getElementPropDefaults } from "@andesine/contracts/extensions";
import {
  type ElementViewMount,
  type ElementViewRenderer,
  type ElementViews
} from "@andesine/editor";
import { useWorkspace } from "#web/context/workspace";
import { extensionActiveViewsQuery } from "#web/lib/data";
import {
  createRootFinder,
  getTemplateParents,
  isExtensionChange,
  matchElementView,
  runningExtensions,
  type RunningExtension
} from "#web/lib/extensions";
import { createAsync, revalidate } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  on,
  onCleanup,
  Show,
  untrack
} from "solid-js";
import { insert } from "solid-js/web";
import { ExtensionView } from "./extension-view";
import { ScopedIcon } from "./scoped-icon";
import { ContentSlotContext } from "./host-components";

interface ViewScopes {
  /** The root view that draws the element: its own view, or the root of its template. */
  get(key: string | null): string | undefined;
  register(key: string, rootViewID: string): () => void;
}
interface MountedView {
  id: string;
  rootID: string;
}
interface ViewParking {
  /** Keeps a removed view until the current task ends, then disposes it. */
  park(key: string, view: MountedView, dispose: () => void): void;
  /** A parked view with the key, e.g. of a moved element; a template's under the same root. */
  claim(key: string, rootID?: string): MountedView | null;
}

type ViewProps = NonNullable<Parameters<RunningExtension["host"]["createView"]>[1]>;
/** A view of its own entry, or a child element's view from its root view's template. */
type ViewSource = { name: string } | { template: string };

const createViewScopes = (): ViewScopes => {
  const [scopes, setScopes] = createSignal(new Map<string, string>());

  return {
    get: (key) => (key ? scopes().get(key) : undefined),
    register(key, rootViewID) {
      setScopes((current) => new Map(current).set(key, rootViewID));

      return () => {
        setScopes((current) => {
          const next = new Map(current);

          next.delete(key);

          return next;
        });
      };
    }
  };
};
/**
 * Moving an element removes its node view and adds a new one in the same change; parked views let
 * the new one take over the old view, with the extension's state, e.g. an open accordion.
 */
const createViewParking = (): ViewParking => {
  const views = new Map<string, MountedView & { timer: ReturnType<typeof setTimeout> }>();

  return {
    park(key, view, dispose) {
      const previous = views.get(key);

      if (previous) clearTimeout(previous.timer);

      views.set(key, {
        ...view,
        timer: setTimeout(() => {
          views.delete(key);
          dispose();
        })
      });
    },
    claim(key, rootID) {
      const parked = views.get(key);

      if (!parked || (rootID && parked.rootID !== rootID)) return null;

      clearTimeout(parked.timer);
      views.delete(key);

      return { id: parked.id, rootID: parked.rootID };
    }
  };
};
const getSourceKey = (source: ViewSource): string => {
  return "name" in source ? source.name : `template:${source.template}`;
};
const mountView = (
  extension: RunningExtension,
  source: ViewSource,
  mount: ElementViewMount,
  scopes: ViewScopes,
  parking: ViewParking,
  owner: ReturnType<typeof getOwner>
): (() => void) => {
  return createRoot((dispose) => {
    const [view, setView] = createSignal<MountedView | null>(null);
    const sourceKey = getSourceKey(source);
    const getParkingKey = () => {
      const key = untrack(mount.place).key;

      return key && `${extension.extensionID}:${sourceKey}:${key}`;
    };
    // The key is the element's node ID, as in a parent's `children`.
    const viewProps = () => {
      const { parentID: _parentID, ...place } = mount.place();

      return { element: mount.name(), props: mount.props(), ...place } as unknown as ViewProps;
    };
    const slot = {
      contentDOM: mount.contentDOM,
      parking: mount.parking,
      owner: null,
      setBlockPresentation: mount.setChildPresentation
    };

    let disposed = false;
    let starting = false;

    // After the change that adds the node view, which can also remove the element's old one.
    const start = (create: () => MountedView, rootID?: string) => {
      if (starting) return;

      starting = true;
      queueMicrotask(() => {
        const key = getParkingKey();

        if (disposed) return;

        const parked = key ? parking.claim(key, rootID) : null;

        if (parked) extension.host.updateView(parked.id, untrack(viewProps));

        setView(parked ?? create());
      });
    };

    onCleanup(() => (disposed = true));

    if ("name" in source) {
      start(() => {
        const id = extension.host.createView(source.name, untrack(viewProps));

        return { id, rootID: id };
      });
    }

    // A template view starts once its parent's root view is known.
    createEffect(() => {
      const rootID = scopes.get(mount.place().parentID);

      if ("template" in source && rootID && !untrack(view)) {
        start(() => {
          const props = untrack(viewProps);

          return { id: extension.host.createTemplateView(rootID, source.template, props), rootID };
        }, rootID);
      }
    });
    // The view's lifetime depends only on its ID; the place, e.g. the selection, changes often.
    createEffect(() => {
      const current = view();

      if (!current) return;

      const offViewError = extension.onViewError(current.id, mount.fallback);

      extension.host.setViewTarget(current.id, {
        setElementProps: mount.setProps,
        // The editor checks the block against its schema.
        append: (block) => mount.append(block as Parameters<ElementViewMount["append"]>[0])
      });
      createEffect(
        on(viewProps, (props) => extension.host.updateView(current.id, props), { defer: true })
      );

      onCleanup(() => {
        const key = getParkingKey();

        offViewError();

        if (key) parking.park(key, current, () => extension.host.disposeView(current.id));
        else extension.host.disposeView(current.id);
      });
    });
    const key = createMemo(() => mount.place().key);

    createEffect(() => {
      const current = view();

      if (current && key()) onCleanup(scopes.register(key()!, current.rootID));
    });
    insert(mount.container, () => (
      <Show when={view()}>
        {(current) => (
          <ContentSlotContext.Provider value={slot}>
            {/* Soft shadows, e.g. a card's, show outside the element's box. */}
            <ExtensionView
              host={extension.host}
              viewID={current().id}
              class="flex flex-1 flex-col"
              bleed
            />
          </ContentSlotContext.Provider>
        )}
      </Show>
    ));

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
  const scopes = createViewScopes();
  const parking = createViewParking();
  const renderers = new WeakMap<RunningExtension, Map<string, ElementViewRenderer>>();
  const getRenderer = (extension: RunningExtension, source: ViewSource): ElementViewRenderer => {
    const key = getSourceKey(source);
    const bySource = renderers.get(extension) ?? new Map<string, ElementViewRenderer>();
    const renderer = bySource.get(key) ?? {
      mount: (mount) => mountView(extension, source, mount, scopes, parking, owner)
    };

    bySource.set(key, renderer);
    renderers.set(extension, bySource);

    return renderer;
  };
  onCleanup(
    subscribeToUpdates((event) => {
      if (isExtensionChange(event.action)) void revalidate(extensionActiveViewsQuery.key);
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

  const findRoot = createMemo(() => createRootFinder(getSources(), activeViews() ?? []));
  const match = (name: string, ancestors: string[]) => {
    return matchElementView(findRoot(), name, ancestors);
  };

  return {
    resolve(name, ancestors) {
      const found = match(name, ancestors);

      return found ? getRenderer(found.extension, found.view) : null;
    },
    schema(name, ancestors) {
      return match(name, ancestors)?.props ?? null;
    },
    parents(name) {
      const roots = (activeViews() ?? []).map(({ selector }) => selector);

      return getTemplateParents(findRoot(), roots, name);
    },
    describe(name, ancestors) {
      const found = match(name, ancestors);

      return found
        ? {
            accepts: found.accepts,
            rejects: found.rejects,
            content: found.content,
            props: getElementPropDefaults(found.props)
          }
        : null;
    },
    list() {
      return (activeViews() ?? []).flatMap(({ selector }) => {
        const root = findRoot()(selector);

        if (!root) return [];

        const { extension, view } = root;
        const getIcon = (icon?: string) => {
          return icon && (() => <ScopedIcon extension={extension.name} icon={icon} />);
        };
        const children = view.children
          .filter((child) => child.name)
          .map((child) => ({
            element: child.element,
            label: child.name!,
            description: child.description,
            icon: getIcon(child.icon),
            selfClosing: !(child.content ?? true),
            props: getElementPropDefaults(child.props),
            parent: view.element,
            category: child.category ?? view.category
          }));

        return [
          {
            element: view.element,
            label: view.name,
            description: view.description,
            icon: getIcon(view.icon),
            selfClosing: !(view.content ?? view.children.length > 0),
            props: getElementPropDefaults(view.props),
            category: view.category
          },
          ...children
        ];
      });
    }
  };
};

export { createElementViews };
