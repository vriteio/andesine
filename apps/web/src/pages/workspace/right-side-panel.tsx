import { IconButton, Skeleton, Tooltip } from "@andesine/components";
import { useLocation, useParams, useSearchParams } from "@solidjs/router";
import { type Component, createEffect, createMemo, For, type JSX, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useLayout } from "#web/context/layout";
import { useWorkspace } from "#web/context/workspace";
import { VersionHistoryPanel } from "./version-history-panel";
import { VersionHistorySkeleton } from "./version-history/skeleton";
import { SchemaVersionHistoryPanel } from "./schema/version-history-panel";
import { PublishingPanel, PublishingPanelFallback } from "./publishing";
import { usePublishing } from "#web/context/publishing";
import { RIGHT_SIDE_PANEL_PARAM } from "./panel-navigation";
import { usePanelContext, usePublishingResolved } from "./use-panel-context";
import { ExtensionIconScope, ExtensionPanelView } from "#web/components/extensions/panel-view";
import {
  extensionsLoading,
  getExtensionPanels,
  runningExtensions,
  type RunningExtensionPanel
} from "#web/lib/extensions";

interface RightSidePanelOption {
  id: string;
  label: string;
  icon: string;
  /** The extension whose manifest icon CSS styles `icon`. */
  extension?: string;
  component: Component<{ opened?: boolean }>;
  fallback: Component;
  available(): boolean;
}
interface RightSidePanelIconProps {
  option: RightSidePanelOption;
  children: JSX.Element;
}

const DEFAULT_RIGHT_SIDE_PANEL_WIDTH = 248;
const PUBLISHING_PANEL_ID = "publishing";
// The built-in versions panels are the default, so they have no search parameter.
const DEFAULT_PANEL_IDS = ["versions", "schema-versions"];
const extensionOptions = new WeakMap<RunningExtensionPanel, RightSidePanelOption>();

const VersionHistoryPanelFallback: Component = () => {
  return (
    <div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-1">
      <div class="flex h-9 shrink-0 items-center">
        <h2 class="text-2xl font-semibold">Versions</h2>
      </div>
      <VersionHistorySkeleton />
    </div>
  );
};

/** Whether the route has no right panel: settings, or a collection's access page. */
const useRightSidePanelHidden = () => {
  const location = useLocation();
  const params = useParams<{ workspaceID?: string; slug?: string }>();

  return () => {
    const isSettingsRoute = location.pathname.startsWith(`/${params.workspaceID || ""}/settings`);

    return isSettingsRoute || Boolean(params.slug?.startsWith("coll_"));
  };
};
/** Whether the panels may still change, e.g. while the publishing state and extensions load. */
const useRightSidePanelLoading = () => {
  const { content } = useWorkspace();
  const publishingAvailabilityResolved = usePublishingResolved();

  return () => {
    // Offline, extensions don't load and no panels show.
    if (content.offline()) return false;

    const isStarting = runningExtensions().some((extension) => extension.status() === "starting");

    return !publishingAvailabilityResolved() || extensionsLoading() || isStarting;
  };
};
const useRightSidePanelOptions = () => {
  const params = useParams<{ slug?: string; extensionID?: string; pageID?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { content, currentWorkspace } = useWorkspace();
  const publishing = usePublishing();
  const panelContext = usePanelContext();
  const entry = createMemo(() => content.entries.get({ entryID: params.slug || "" }));
  const deletedEntry = createMemo(() => {
    return entry() ? undefined : publishing.getDeletedEntry(params.slug || "");
  });
  const schema = createMemo(() => {
    return content.schemasCollection().findOne({ id: params.slug || "" });
  });
  const publishingAvailable = createMemo(() => {
    const currentEntry = entry();
    const currentDeletedEntry = deletedEntry();
    const status = currentEntry ? content.getEntryPublishingStatus(currentEntry.id) : null;
    const publishedRoot = publishing.getPublishedEntryRoot(params.slug || "");
    // Collection pages and collection-bound extension pages show their collection's publishing.
    const collectionID = currentEntry || currentDeletedEntry ? null : panelContext().collectionID;
    const publishingCollectionID = collectionID && content.getPublishingCollectionID(collectionID);

    return Boolean(
      currentWorkspace() &&
      (currentDeletedEntry ||
        publishedRoot ||
        (currentEntry &&
          status &&
          status !== "outside" &&
          content.canEntry(currentEntry.collectionID || null, "publishing:read")) ||
        (publishingCollectionID && content.canEntry(publishingCollectionID, "publishing:read")))
    );
  });
  const publishingAvailabilityResolved = usePublishingResolved();
  // Extensions get only context IDs: the panel's entry and collection, or the schema's collection.
  const context = createMemo((): Record<string, string> => {
    const { entryID, collectionID: panelCollectionID } = panelContext();
    const collectionID = panelCollectionID || (entryID ? null : schema()?.collectionID);
    // The nearest collection with publishing on, e.g. a docs site's root for a nested entry.
    const publishingCollectionID = collectionID && content.getPublishingCollectionID(collectionID);

    return {
      ...(entryID && { entryID }),
      ...(collectionID && { collectionID }),
      ...(publishingCollectionID && { publishingCollectionID })
    };
  });
  const getPanelContext = (item: RunningExtensionPanel): Record<string, string> => {
    const isOwnPage = params.pageID && params.extensionID === item.extension.extensionID;
    // The open page of the panel's extension, e.g. to mark it in the panel's navigation.
    const page: Record<string, string> = isOwnPage ? { pageID: params.pageID! } : {};

    if (item.panel.side !== "right" || item.panel.context === "workspace") return page;

    // Collection panels also get the open entry, e.g. to link its page.
    return item.panel.context === "entry" || context().collectionID
      ? { ...context(), ...page }
      : {};
  };
  const isPanelAvailable = (item: RunningExtensionPanel): boolean => {
    const context = getPanelContext(item);

    if (item.panel.side !== "right" || item.panel.context === "workspace") return true;
    // Its `publishingCollectionID` is known only then; the panel's loading state shows meanwhile.
    if (!publishingAvailabilityResolved()) return false;

    return Boolean(item.panel.context === "entry" ? context.entryID : context.collectionID);
  };
  const getExtensionOption = (item: RunningExtensionPanel): RightSidePanelOption => {
    const option = extensionOptions.get(item) ?? {
      id: item.id,
      label: item.panel.name,
      icon: item.panel.icon,
      extension: item.extension.name,
      component: () => <ExtensionPanelView item={item} context={getPanelContext(item)} />,
      fallback: () => null,
      available: () => isPanelAvailable(item)
    };

    extensionOptions.set(item, option);

    return option;
  };
  const options: RightSidePanelOption[] = [
    {
      id: "versions",
      label: "Versions",
      icon: "i-lucide:history",
      component: VersionHistoryPanel,
      fallback: VersionHistoryPanelFallback,
      available: () => {
        const currentEntry = entry();

        return Boolean(
          (currentEntry || deletedEntry()?.canReadVersions) &&
          currentWorkspace() &&
          (!currentEntry || content.canEntry(currentEntry.collectionID || null, "version:read"))
        );
      }
    },
    {
      id: PUBLISHING_PANEL_ID,
      label: "Publishing",
      icon: "i-lucide:radio",
      component: PublishingPanel,
      fallback: PublishingPanelFallback,
      available: () => {
        return (
          publishingAvailable() ||
          (searchParams[RIGHT_SIDE_PANEL_PARAM] === PUBLISHING_PANEL_ID &&
            !publishingAvailabilityResolved())
        );
      }
    },
    {
      id: "schema-versions",
      label: "Versions",
      icon: "i-lucide:history",
      component: SchemaVersionHistoryPanel,
      fallback: VersionHistoryPanelFallback,
      available: () => {
        const currentSchema = schema();

        return Boolean(
          currentSchema &&
          currentWorkspace() &&
          content.canCollection(currentSchema.collectionID, "collection:read")
        );
      }
    }
  ];

  createEffect(() => {
    if (searchParams[RIGHT_SIDE_PANEL_PARAM] !== PUBLISHING_PANEL_ID) return;
    if (!publishingAvailabilityResolved() || publishingAvailable()) return;

    setSearchParams({ [RIGHT_SIDE_PANEL_PARAM]: undefined }, { replace: true });
  });

  return createMemo(() => {
    const extensions = getExtensionPanels("right").map(getExtensionOption);

    return content.offline()
      ? []
      : [...options, ...extensions].filter((option) => option.available());
  });
};

// Extension icons come from their manifest icon CSS, which applies only inside the scope.
const RightSidePanelIcon: Component<RightSidePanelIconProps> = (props) => (
  <Show when={props.option.extension} fallback={props.children}>
    {(extension) => (
      <ExtensionIconScope extension={extension()}>{props.children}</ExtensionIconScope>
    )}
  </Show>
);
const RightSidePanel: Component = () => {
  const { layout } = useLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const options = useRightSidePanelOptions();
  const loading = useRightSidePanelLoading();
  const selectedOption = createMemo(() => {
    const requested = searchParams[RIGHT_SIDE_PANEL_PARAM];
    const requestedOptionID = typeof requested === "string" && requested ? requested : "versions";
    const option = options().find((item) => item.id === requestedOptionID);

    // A requested extension panel shows once its extension starts, not another panel meanwhile.
    return option || (loading() && requested ? undefined : options()[0]);
  });
  const selectOption = (option: RightSidePanelOption) => {
    setSearchParams({
      [RIGHT_SIDE_PANEL_PARAM]: DEFAULT_PANEL_IDS.includes(option.id) ? undefined : option.id
    });
  };

  return (
    <div class="flex min-h-0 w-full flex-1 flex-col">
      <div class="flex w-full gap-1 px-1">
        <Show when={options().length === 0 && layout.rightSidePanelWidth > 0}>
          <Skeleton class={["h-7 w-7 rounded-lg", "h-7 w-7 rounded-lg", "h-7 w-7 rounded-lg"]} />
        </Show>
        <For each={options()}>
          {(option) => {
            const selected = () => selectedOption()?.id === option.id;

            return (
              <Tooltip content={option.label} placement="bottom" fixed>
                <div class="relative flex items-center justify-center">
                  <Show when={selected()}>
                    <div class="absolute left-0 top-0 h-full w-full rounded-lg bg-gradient-to-tr opacity-10" />
                  </Show>
                  <RightSidePanelIcon option={option}>
                    <IconButton
                      // The selected option shows a gradient icon on its highlight.
                      variant={selected() ? "link" : "ghost"}
                      hover={!selected()}
                      iconProps={{ class: "h-5 w-5" }}
                      icon={option.icon}
                      onClick={() => selectOption(option)}
                      aria-label={option.label}
                      aria-pressed={selected()}
                    />
                  </RightSidePanelIcon>
                </div>
              </Tooltip>
            );
          }}
        </For>
      </div>
      <div class="relative flex min-h-0 w-full flex-1">
        <Show
          when={layout.rightSidePanelWidth > 0 && selectedOption()}
          fallback={
            <Show when={layout.rightSidePanelWidth > 0}>
              {/* While panels load, only the option skeletons show; each panel has its own. */}
              <Show when={!loading()}>
                <VersionHistoryPanelFallback />
              </Show>
            </Show>
          }
          keyed
        >
          {(option) => (
            <Suspense fallback={<Dynamic component={option.fallback} />}>
              <Dynamic component={option.component} />
            </Suspense>
          )}
        </Show>
      </div>
    </div>
  );
};

const RightSidePanelToggle: Component = () => {
  const { layout, setLayout } = useLayout();
  const options = useRightSidePanelOptions();
  const loading = useRightSidePanelLoading();
  const hidden = useRightSidePanelHidden();
  const opened = () => layout.rightSidePanelWidth > 0;

  return (
    <Show when={!hidden() && (options().length > 0 || (opened() && loading()))}>
      <Tooltip
        content={opened() ? "Close side panel" : "Open side panel"}
        placement="bottom"
        wrapperClass="hidden md:flex"
        fixed
      >
        <IconButton
          icon={opened() ? "i-lucide:panel-right-close" : "i-lucide:panel-right-open"}
          variant="ghost"
          onClick={() => {
            setLayout("rightSidePanelWidth", opened() ? 0 : DEFAULT_RIGHT_SIDE_PANEL_WIDTH);
          }}
          aria-label={opened() ? "Close side panel" : "Open side panel"}
          aria-expanded={opened()}
        />
      </Tooltip>
    </Show>
  );
};

export {
  DEFAULT_RIGHT_SIDE_PANEL_WIDTH,
  RightSidePanel,
  RightSidePanelIcon,
  RightSidePanelToggle,
  useRightSidePanelHidden,
  useRightSidePanelLoading,
  useRightSidePanelOptions
};
