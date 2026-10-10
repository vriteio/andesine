import { IconButton, Skeleton, Tooltip } from "@andesine/components";
import { useParams, useSearchParams } from "@solidjs/router";
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
import { ExtensionIconScope, ExtensionPanelView } from "#web/components/extensions/panel-view";
import { getExtensionPanels, type RunningExtensionPanel } from "#web/lib/extensions";

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

const useRightSidePanelOptions = () => {
  const params = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { content, currentWorkspace } = useWorkspace();
  const publishing = usePublishing();
  const publishingAvailable = () => {
    const entry = content.entries.get({ entryID: params.slug || "" });
    const deletedEntry = entry ? undefined : publishing.getDeletedEntry(params.slug || "");
    const status = entry ? content.getEntryPublishingStatus(entry.id) : null;
    const publishedRoot = publishing.getPublishedEntryRoot(params.slug || "");

    return Boolean(
      currentWorkspace() &&
      (deletedEntry ||
        publishedRoot ||
        (entry &&
          status &&
          status !== "outside" &&
          content.canEntry(entry.collectionID || null, "publishing:read")))
    );
  };
  const publishingAvailabilityResolved = () => {
    return (
      content.offline() ||
      (!content.loading() && !publishing.statusLoading() && !publishing.explorerOverlayLoading())
    );
  };
  // Extensions get only context IDs: the current entry and its collection, or the schema's.
  const getContext = (): Record<string, string> => {
    const entry = content.entries.get({ entryID: params.slug || "" });
    const schema = entry ? null : content.schemasCollection().findOne({ id: params.slug || "" });
    const collectionID = entry?.collectionID || schema?.collectionID || null;

    return {
      ...(entry && { entryID: entry.id }),
      ...(collectionID && { collectionID })
    };
  };
  const getPanelContext = (item: RunningExtensionPanel): Record<string, string> => {
    const context = getContext();

    if (item.panel.side !== "right" || item.panel.context === "workspace") return {};

    if (item.panel.context === "entry") return context;

    return context.collectionID ? { collectionID: context.collectionID } : {};
  };
  const isPanelAvailable = (item: RunningExtensionPanel): boolean => {
    const context = getPanelContext(item);

    if (item.panel.side !== "right" || item.panel.context === "workspace") return true;

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
        const entry = content.entries.get({ entryID: params.slug || "" });
        const deletedEntry = entry ? undefined : publishing.getDeletedEntry(params.slug || "");

        return Boolean(
          (entry || deletedEntry?.canReadVersions) &&
          currentWorkspace() &&
          (!entry || content.canEntry(entry.collectionID || null, "version:read"))
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
        const schema = content.schemasCollection().findOne({ id: params.slug || "" });

        return Boolean(
          schema &&
          currentWorkspace() &&
          content.canCollection(schema.collectionID, "collection:read")
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
  const selectedOption = createMemo(() => {
    const requested = searchParams[RIGHT_SIDE_PANEL_PARAM];
    const requestedOptionID = typeof requested === "string" && requested ? requested : "versions";

    return options().find((option) => option.id === requestedOptionID) || options()[0];
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
          <Skeleton class={["h-7 w-7 rounded-lg", "h-7 w-7 rounded-lg"]} />
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
              <VersionHistoryPanelFallback />
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
  const opened = () => layout.rightSidePanelWidth > 0;

  return (
    <Show when={options().length > 0}>
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
  useRightSidePanelOptions
};
