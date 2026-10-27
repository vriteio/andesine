import { createRef, ScrollArea, ScrollShadow, Spinner } from "@andesine/components";
import { ExtensionIcon } from "#web/components/extensions/extension-icon";
import { ExtensionView } from "#web/components/extensions/extension-view";
import { useExtensionView } from "#web/components/extensions/use-extension-view";
import { extensionRuntimeQuery } from "#web/lib/data";
import {
  findExtensionPage,
  getExtensionPagePath,
  isPageAvailabilityKnown,
  isPageAvailable,
  resolvePageContext,
  type RunningExtensionPage
} from "#web/lib/extensions";
import { useRouteData } from "#web/lib/navigation";
import { usePublishingResolved } from "../use-panel-context";
import { Title } from "@solidjs/meta";
import { createAsync, useParams, useSearchParams } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Match,
  onCleanup,
  Show,
  Switch
} from "solid-js";

interface ExtensionPageViewProps {
  item: RunningExtensionPage;
  /** Context IDs only: the page's collection or entry. */
  context: Record<string, string>;
  /** Whether the view shows something: its content or the unavailable message. */
  onShown(shown: boolean): void;
}

// As in the settings layout.
const PageSpinner: Component = () => (
  <div class="flex w-full flex-1 items-center justify-center py-16 text-gray-200">
    <Spinner />
  </div>
);
const ExtensionPageView: Component<ExtensionPageViewProps> = (props) => {
  const { host } = props.item.extension;
  const { viewID, rendered, unavailable } = useExtensionView(
    props.item.extension,
    props.item.page.view,
    () => props.context
  );

  onCleanup(() => props.onShown(false));
  createEffect(() => props.onShown(rendered() || unavailable()));

  return (
    <Show
      when={!unavailable()}
      fallback={<span class="text-sm text-gray-500">This page is unavailable.</span>}
    >
      {/* Paint containment clips at its box; the margin lets controls' shadows show. */}
      <ExtensionView host={host} viewID={viewID} class="-m-2 p-2" />
    </Show>
  );
};
/** A page of an extension in the main area; collection and entry pages get their ID. */
const ExtensionPagePage: Component = () => {
  const params = useParams<{ workspaceID: string; extensionID: string; pageID: string }>();
  const [searchParams] = useSearchParams<{ collectionID?: string; entryID?: string }>();
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);
  const routeData = useRouteData();
  const [viewShown, setViewShown] = createSignal(false);
  const publishingResolved = usePublishingResolved();
  const runtime = createAsync(() => extensionRuntimeQuery(params.workspaceID));
  const found = () => findExtensionPage(params.extensionID, params.pageID);
  // The runtime list knows the page before the extension starts, e.g. right after a refresh.
  const page = () => {
    const extension = runtime()?.find(({ id }) => id === params.extensionID);

    return found()?.page ?? extension?.pages.find(({ id }) => id === params.pageID) ?? null;
  };
  // As for panels, with the nearest collection with publishing on, e.g. a docs site's root.
  const context = createMemo((): Record<string, string> => {
    if (page()?.context === "collection" && searchParams.collectionID) {
      return { ...resolvePageContext({ collectionID: searchParams.collectionID }) };
    }

    if (page()?.context === "entry" && searchParams.entryID) {
      const { entryID, publishingCollectionID } = resolvePageContext({
        entryID: searchParams.entryID
      });

      return { entryID: entryID!, ...(publishingCollectionID && { publishingCollectionID }) };
    }

    return {};
  });
  const isContextValid = () => {
    const current = page();

    return Boolean(
      current && getExtensionPagePath(params.workspaceID, params.extensionID, current, context())
    );
  };
  // Unavailable by its `when` conditions, once their storage keys have loaded.
  const isAvailable = () => {
    const current = page();

    return Boolean(current && isPageAvailable(params.extensionID, current, context()));
  };
  // Also once publishing collections are known, e.g. for a `publishing` condition after a reload.
  const isAvailabilityKnown = () => {
    const current = page();

    return Boolean(
      current && publishingResolved() && isPageAvailabilityKnown(params.extensionID, current)
    );
  };
  // Missing once the runtime list loaded without the page, or the page isn't available here.
  const isMissing = () => {
    return Boolean(runtime()) && (!isContextValid() || (isAvailabilityKnown() && !isAvailable()));
  };
  // Like settings: a spinner until the extension's details load and the view shows something.
  const isLoading = () => !isMissing() && (Boolean(routeData()?.loading) || !viewShown());
  // A plain function, not a ternary in the JSX: the meta tags read it on cleanup, outside an owner.
  const documentTitle = () => (page() ? `${page()!.name} | Andesine` : "Andesine");
  // Compared by its extension and page, so new lookups of the same page don't remount the view.
  const ready = createMemo(
    () => {
      const item = found();
      const isShown = isContextValid() && isAvailabilityKnown() && isAvailable();

      return item && item.extension.status() !== "starting" && isShown ? item : null;
    },
    null,
    { equals: (a, b) => a?.extension === b?.extension && a?.page === b?.page }
  );

  return (
    <>
      <Title>{documentTitle()}</Title>
      {/* The settings layout: its width, title, and scrolling. */}
      <div class="flex w-full flex-1 overflow-hidden px-1">
        <div class="relative flex h-full w-full overflow-hidden">
          <ScrollShadow scrollableContainerRef={scrollableContainerRef} />
          <ScrollArea
            class="z-0 w-full"
            contentClass="flex min-h-full flex-col"
            viewportRef={setScrollableContainerRef}
          >
            <div class="flex w-full flex-1 flex-col items-center px-2.5 pb-5 pt-5 md:px-10 md:pb-10 md:pt-9">
              <Show when={isLoading()}>
                <PageSpinner />
              </Show>
              <div class="relative flex w-full max-w-[44rem] flex-1 flex-col" hidden={isLoading()}>
                <div class="mb-3 flex items-start gap-3">
                  <Show when={routeData()?.extensionIcon}>
                    {(source) => (
                      <div class="flex h-[1lh] shrink-0 items-center text-4xl md:text-5xl">
                        <ExtensionIcon
                          name={source().name}
                          icon={source().icon}
                          iconStyles={source().iconStyles}
                          class="h-8 w-8 md:h-10 md:w-10"
                        />
                      </div>
                    )}
                  </Show>
                  <h1 class="min-w-0 text-4xl font-semibold md:text-5xl">
                    {page()?.name ?? routeData()?.title}
                  </h1>
                </div>
                <Switch>
                  <Match when={isMissing()}>
                    <span class="text-sm text-gray-500">This page is unavailable.</span>
                  </Match>
                  <Match when={ready()} keyed>
                    {(item) => (
                      <ExtensionPageView item={item} context={context()} onShown={setViewShown} />
                    )}
                  </Match>
                </Switch>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default ExtensionPagePage;
