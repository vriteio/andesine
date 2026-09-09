import clsx from "clsx";
import {
  createDebounced,
  createRef,
  createScrollShadowController,
  Dialog,
  Dropdown,
  IconButton,
  Input,
  ScrollShadow,
  Skeleton,
  Tooltip
} from "@andesine/components";
import { createMediaQuery } from "@solid-primitives/media";
import { createAsync, query } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show
} from "solid-js";
import { client } from "#web/lib/api";
import { isOffline } from "#web/lib/offline";
import { SearchResultLink, SearchResultNotice } from "./search-dialog/search-results";

interface ImageSearchProps {
  workspaceID: string;
  onSelect(image: ImageSearchResult): void;
  onClose(): void;
}
type ImageSearchResult = Awaited<ReturnType<typeof client.assets.search>>["body"][number];

const searchImages = query(async (workspaceID: string, text: string, refresh: number) => {
  // Refresh signed thumbnails while the results remain open.
  void refresh;
  return (
    await client.assets.search(
      { query: text, limit: 24 },
      {
        context: { headers: { "x-workspace-id": workspaceID } }
      }
    )
  ).body;
}, "image-search");

const ImageSearch = (props: ImageSearchProps) => {
  const resultID = createUniqueId();
  const md = createMediaQuery("(min-width: 768px)");
  const [resultsRef, setResultsRef] = createRef<HTMLDivElement>(null!);
  const scrollShadowController = createScrollShadowController();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [text, setText] = createSignal("");
  const [refresh, setRefresh] = createSignal(Date.now());
  const debouncedText = createDebounced(() => text().trim(), 250);
  const requestKey = () => JSON.stringify([props.workspaceID, text().trim()]);
  const response = createAsync(
    async () => {
      const workspaceID = props.workspaceID;
      const searchText = debouncedText();
      const key = JSON.stringify([workspaceID, searchText]);
      const refreshAt = refresh();

      if (isOffline()) return { key, results: [], error: false };

      try {
        return {
          key,
          results: await searchImages(workspaceID, searchText, refreshAt),
          error: false
        };
      } catch {
        return { key, results: [], error: true };
      }
    },
    {
      // Keep the editor mounted while the first search loads; `.latest` otherwise suspends.
      initialValue: { key: "", results: [], error: false }
    }
  );
  const current = () => (response.latest?.key === requestKey() ? response.latest : undefined);

  createEffect(() => {
    text();
    setSelectedIndex(0);
  });

  createEffect(() => {
    current();
    isOffline();
    queueMicrotask(() => scrollShadowController.processScrollState());
  });

  onMount(() => {
    const timer = setInterval(() => setRefresh(Date.now()), 45_000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div class="flex min-h-0 w-full flex-1 flex-col gap-2">
      <div class="flex shrink-0 items-center gap-1 px-1 pt-1">
        <Input
          ref={(input) => {
            if (md()) queueMicrotask(() => input.focus({ preventScroll: true }));
          }}
          aria-autocomplete="list"
          value={text()}
          setValue={setText}
          placeholder="Search by filename, text, or description…"
          aria-label="Search images"
          role="combobox"
          aria-expanded={Boolean(current()?.results.length)}
          aria-controls={resultID}
          aria-activedescendant={
            current()?.results.length ? `${resultID}-${selectedIndex()}` : undefined
          }
          onKeyDown={(event) => {
            const results = current()?.results || [];
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const index = Math.max(
                0,
                Math.min(results.length - 1, selectedIndex() + (event.key === "ArrowDown" ? 1 : -1))
              );
              setSelectedIndex(index);
              document.getElementById(`${resultID}-${index}`)?.scrollIntoView({ block: "nearest" });
            } else if (event.key === "Enter" && results[selectedIndex()]) {
              event.preventDefault();
              props.onSelect(results[selectedIndex()]);
            }
          }}
          maxLength={500}
          class="min-w-0 flex-1 bg-transparent focus:shadow-none"
          size="small"
        />
        <Tooltip content="Close">
          <IconButton
            type="button"
            variant="text"
            icon="i-lucide:x"
            text="soft"
            size="small"
            aria-label="Close image search"
            onClick={props.onClose}
          />
        </Tooltip>
      </div>
      <div class="relative flex min-h-0 flex-1 overflow-hidden">
        <ScrollShadow controller={scrollShadowController} scrollableContainerRef={resultsRef} />
        <div
          ref={setResultsRef}
          id={resultID}
          role="listbox"
          aria-label="Image results"
          aria-busy={!isOffline() && !current()}
          class="relative z-0 flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-1 pb-1 md:max-h-[min(60dvh,32rem)]"
        >
          <Show
            when={!isOffline()}
            fallback={
              <SearchResultNotice
                icon="i-lucide:wifi-off"
                label="You're offline"
                sublabel="Connect to search images"
              />
            }
          >
            <Show
              when={current()}
              fallback={
                <div class="flex flex-col gap-2 p-2">
                  <For each={[0, 1, 2]}>
                    {() => (
                      <div class="flex gap-3">
                        <Skeleton class="h-14 w-20 rounded-md" />
                        <div class="flex flex-1 flex-col justify-center gap-2">
                          <Skeleton class="h-4 w-2/3 rounded" />
                          <Skeleton class="h-3 w-1/3 rounded" />
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              }
            >
              {(result) => (
                <Show
                  when={!result().error}
                  fallback={
                    <>
                      <SearchResultNotice
                        color="danger"
                        icon="i-lucide:triangle-alert"
                        label="Image search is unavailable"
                        sublabel="Check your connection and try again"
                      />
                      <SearchResultLink
                        icon="i-lucide:rotate-cw"
                        label="Retry"
                        onClick={() => setRefresh(Date.now())}
                      />
                    </>
                  }
                >
                  <Show
                    when={result().results.length}
                    fallback={
                      <SearchResultNotice
                        icon="i-lucide:search-x"
                        label="No images found"
                        sublabel="Only images used in accessible entries appear here"
                      />
                    }
                  >
                    <>
                      <For each={result().results}>
                        {(image, index) => (
                          <button
                            type="button"
                            id={`${resultID}-${index()}`}
                            role="option"
                            aria-selected={index() === selectedIndex()}
                            onPointerEnter={() => setSelectedIndex(index())}
                            class={clsx(
                              "group flex min-w-0 shrink-0 items-center gap-3 rounded-lg p-2 text-left focus-visible:bg-gray-100",
                              index() === selectedIndex() &&
                                "bg-gradient-to-r from-gray-500/10 to-transparent"
                            )}
                            onClick={() => props.onSelect(image)}
                          >
                            <div class="h-14 w-20 shrink-0 overflow-hidden rounded-md">
                              <img
                                src={image.thumbnailURL}
                                alt=""
                                class="h-full w-full object-contain"
                                draggable={false}
                              />
                            </div>
                            <div class="min-w-0 flex-1">
                              <div class="truncate text-sm font-medium">{image.filename}</div>
                              <Show when={image.description}>
                                <div class="line-clamp-2 text-xs text-gray-400">
                                  {image.description}
                                </div>
                              </Show>
                            </div>
                          </button>
                        )}
                      </For>
                    </>
                  </Show>
                </Show>
              )}
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
};
const ImagePicker = (props: ImageSearchProps) => {
  const md = createMediaQuery("(min-width: 768px)");
  const content = () => <ImageSearch {...props} />;

  return (
    <Show
      when={md()}
      fallback={
        <Dropdown
          title="Choose an image"
          class="md:hidden"
          anchorPoint={{ x: 0, y: 0 }}
          mobileSheetDragFromContent={false}
          opened
          setOpened={(opened) => {
            if (!opened) props.onClose();
          }}
          cardProps={{ style: { "min-height": "60dvh" } }}
          portal
        >
          {content()}
        </Dropdown>
      }
    >
      <Dialog
        opened
        onOverlayClick={props.onClose}
        size="xlarge"
        portal
        backdrop={false}
        cardClass="max-h-[80dvh] p-1 gap-2"
        wrapperClass="absolute top-[10dvh]"
        aria-label="Choose an image"
      >
        {content()}
      </Dialog>
    </Show>
  );
};

export { ImageSearch, ImagePicker };
