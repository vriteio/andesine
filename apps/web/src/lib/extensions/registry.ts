import {
  type ExtensionBlockAction,
  type ExtensionElementView,
  type ExtensionPage,
  type ExtensionPanel,
  type ExtensionPermission
} from "@andesine/contracts/extensions";
import { getEffectivePermissions, getExtensionMember, startExtensionContext } from "./authority";
import { config } from "#web/lib/api";
import { type Accessor, createSignal } from "solid-js";
import { createExtensionHost, type ExtensionHost, type ExtensionHostOptions } from "./host";
import { setPageConditions, setPageStorageKey } from "./page-availability";
import { type ExtensionHostActions } from "./requests";

interface RunningExtensionOptions extends Omit<
  ExtensionHostOptions,
  "onFailure" | "onError" | "getActions" | "getAPIContext"
> {
  elementViews: ExtensionElementView[];
  blockActions?: ExtensionBlockAction[];
  panels?: ExtensionPanel[];
  pages?: ExtensionPage[];
  grant?: ExtensionPermission[];
  /** The manifest backend URL; the frontend can call it with a session token. */
  backend?: string;
  displayName: string;
  icon?: string | null;
}
interface RunningExtension {
  extensionID: string;
  name: string;
  /** The manifest's name and icon, e.g. for the menu item of its pages. */
  displayName: string;
  icon: string | null;
  elementViews: ExtensionElementView[];
  blockActions: ExtensionBlockAction[];
  panels: ExtensionPanel[];
  pages: ExtensionPage[];
  host: ExtensionHost;
  status: Accessor<RunningExtensionStatus>;
  dispose(): void;
  /** Registers a view's fallback, called when the extension reports an error for the view. */
  onViewError(viewID: string, fallback: () => void): () => void;
}

interface RunningExtensionPanel {
  /** Stable host ID: `ext:<extensionID>:<panelID>`. */
  id: string;
  extension: RunningExtension;
  panel: ExtensionPanel;
}
interface RunningExtensionPage {
  extension: RunningExtension;
  page: ExtensionPage;
}

type RunningExtensionStatus = "starting" | "ready" | "failed";

const [runningExtensions, setRunningExtensions] = createSignal<RunningExtension[]>([]);
// Until the workspace's extensions are listed and started, e.g. so their panels aren't hidden.
const [extensionsLoading, setExtensionsLoading] = createSignal(true);
// The same item for each panel keeps its view mounted while the panel lists recompute.
const panelItems = new WeakMap<RunningExtension, Map<string, RunningExtensionPanel>>();

let hostActions: ExtensionHostActions | null = null;

const setExtensionHostActions = (actions: ExtensionHostActions): (() => void) => {
  hostActions = actions;

  return () => {
    if (hostActions === actions) hostActions = null;
  };
};
const getExtensionHostActions = (): ExtensionHostActions | null => hostActions;

const stopExtension = (extensionID: string): void => {
  const extension = runningExtensions().find((item) => item.extensionID === extensionID);

  if (!extension) return;

  extension.dispose();
  setPageConditions(extensionID, null);
  setRunningExtensions((items) => items.filter((item) => item !== extension));
};
/** Starts an extension frontend; a failed sandbox makes its views fall back to the tag view. */
const startExtension = async (options: RunningExtensionOptions): Promise<void> => {
  const {
    elementViews,
    blockActions = [],
    panels = [],
    pages = [],
    grant = [],
    backend,
    displayName,
    icon = null,
    ...hostOptions
  } = options;
  const [status, setStatus] = createSignal<RunningExtensionStatus>("starting");
  const viewFallbacks = new Map<string, () => void>();

  let stopContext = () => {};

  stopExtension(options.extensionID);

  const host = await createExtensionHost({
    ...hostOptions,
    displayName,
    connectSources: [...(backend ? [backend] : []), ...hostOptions.connectSources],
    getActions: getExtensionHostActions,
    getAPIContext: () => ({
      apiURL: config.PUBLIC_API_URL,
      permissions: getEffectivePermissions(grant),
      workspaceID: getExtensionMember()?.workspaceID ?? null
    }),
    onFailure(reason) {
      console.warn(`Extension ${options.name} stopped: ${reason}`);
      setStatus("failed");
    },
    onError(message, viewID) {
      console.warn(`Extension ${options.name} error: ${message}`);

      if (viewID) viewFallbacks.get(viewID)?.();
    }
  });

  setRunningExtensions((items) => [
    ...items,
    {
      extensionID: options.extensionID,
      name: options.name,
      displayName,
      icon,
      elementViews,
      blockActions,
      panels,
      pages,
      host,
      status,
      dispose() {
        stopContext();
        host.dispose();
      },
      onViewError(viewID, fallback) {
        viewFallbacks.set(viewID, fallback);

        return () => viewFallbacks.delete(viewID);
      }
    }
  ]);
  setPageConditions(options.extensionID, pages);
  host.ready.then(
    () => {
      setStatus("ready");
      stopContext = startExtensionContext({
        extensionID: options.extensionID,
        host,
        grant,
        backend: backend ?? null
      });
    },
    () => setStatus("failed")
  );
};
const getPanelItem = (
  extension: RunningExtension,
  panel: ExtensionPanel
): RunningExtensionPanel => {
  const items = panelItems.get(extension) ?? new Map<string, RunningExtensionPanel>();
  const item = items.get(panel.id) ?? {
    id: `ext:${extension.extensionID}:${panel.id}`,
    extension,
    panel
  };

  items.set(panel.id, item);
  panelItems.set(extension, items);

  return item;
};
/** Failed extensions keep their panels, which show an error line instead of their content. */
const getExtensionPanels = (side: ExtensionPanel["side"]): RunningExtensionPanel[] => {
  return runningExtensions()
    .filter((extension) => extension.status() !== "starting")
    .flatMap((extension) => {
      return extension.panels
        .filter((panel) => panel.side === side)
        .map((panel) => getPanelItem(extension, panel));
    });
};

/** Pages for menus of extensions that started, optionally only those of one context. */
const getExtensionPages = (context?: ExtensionPage["context"]): RunningExtensionPage[] => {
  return runningExtensions()
    .filter((extension) => extension.status() !== "starting")
    .flatMap((extension) => {
      return extension.pages
        .filter((page) => !page.parent && (!context || page.context === context))
        .map((page) => ({ extension, page }));
    });
};
/** A page of a running extension, whether it started yet or not. */
/**
 * A storage key of an extension was set or deleted, e.g. by its backend: its pages' conditions and
 * its views follow it.
 */
const notifyExtensionStorage = (extensionID: string, key: string, exists: boolean): void => {
  setPageStorageKey(extensionID, key, exists);
  runningExtensions()
    .find((extension) => extension.extensionID === extensionID)
    ?.host.notifyStorage(key, exists);
};
/** An event that changes extensions, e.g. an install; storage writes change only pages and views. */
const isExtensionChange = (action: string): boolean => {
  return action.startsWith("extension:") && action !== "extension:storage";
};
const findExtensionPage = (extensionID: string, pageID: string): RunningExtensionPage | null => {
  const extension = runningExtensions().find((item) => item.extensionID === extensionID);
  const page = extension?.pages.find((item) => item.id === pageID);

  return extension && page ? { extension, page } : null;
};

export {
  runningExtensions,
  extensionsLoading,
  setExtensionsLoading,
  startExtension,
  stopExtension,
  setExtensionHostActions,
  getExtensionHostActions,
  getExtensionPanels,
  getExtensionPages,
  findExtensionPage,
  isExtensionChange,
  notifyExtensionStorage
};
export type {
  RunningExtension,
  RunningExtensionOptions,
  RunningExtensionPanel,
  RunningExtensionPage,
  RunningExtensionStatus
};
