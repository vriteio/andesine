import {
  Button,
  type Card,
  createRef,
  DropdownArea,
  DropdownMenu,
  IconButton,
  type MenuItem
} from "@andesine/components";
import { createAsync, revalidate, useParams, useSearchParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import clsx from "clsx";
import { type Component, type ComponentProps, createMemo, createSignal, Show } from "solid-js";
import { useLayout } from "#web/context/layout";
import { useNotify } from "#web/context/notifications";
import { usePublishing } from "#web/context/publishing";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import {
  type PublishingChannelContent,
  publishingChannelContentQuery,
  publishingExplorerOverlayQuery,
  publishingPublicationsQuery,
  publishingStatusQuery
} from "#web/lib/data";
import { type PublishingPanelActionInput } from "./actions";
import { type PublishingRevertTarget } from "./revert";
import { PublishingPanelTree } from "./tree";
import { PublishingPanelContentSkeleton, PublishingPanelFallback } from "./skeleton";
import { usePublishingRevert } from "./use-publishing-revert";

interface PublishingPanelProps {
  opened?: boolean;
}
interface PublishingPanelResponse {
  channel: string;
  collectionID: string;
  error?: true;
  result?: PublishingChannelContent;
}
interface PublishingMutationInput extends PublishingPanelActionInput {
  channel: string;
  collectionID: string;
}
const PUBLISHED_CHANNEL = "published";

const PublishingPanel: Component<PublishingPanelProps> = (props) => {
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const { layout } = useLayout();
  const { content } = useWorkspace();
  const publishing = usePublishing();
  const notify = useNotify();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const [actionMenuItems, setActionMenuItems] = createSignal<MenuItem[]>([]);
  const [revertCompleted, setRevertCompleted] = createSignal(0);
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);
  const revert = usePublishingRevert({
    currentEntryID: () => params.slug || "",
    snapshotView: () => Boolean(searchParams.snapshotID),
    onCompleted: () => setRevertCompleted((completed) => completed + 1)
  });
  const opened = createMemo(() => props.opened ?? layout.rightSidePanelWidth > 0);
  const entry = () => content.entries.get({ entryID: params.slug || "" });
  const deletedEntry = () => publishing.getDeletedEntry(params.slug || "");
  const publishingCollection = createMemo(() => {
    const currentDeletedEntry = deletedEntry();
    const currentEntry = entry();
    const currentPublishing = content.publishing();
    const entryOverlay = publishing.getEntryOverlayByEntryID(params.slug || "");
    const publishedRoot = publishing.getPublishedEntryRoot(params.slug || "");
    const acceptedCollection = entryOverlay?.publishingCollectionID
      ? {
          id: entryOverlay.publishingCollectionID,
          name: entryOverlay.publishingCollectionName || "Published collection"
        }
      : publishedRoot
        ? { id: publishedRoot.collectionID, name: publishedRoot.name }
        : null;
    const acceptedView = Boolean(searchParams.snapshotID && !searchParams.compare);
    const collection = currentEntry?.collectionID
      ? content.collections.get({ collectionID: currentEntry.collectionID })
      : null;

    if (acceptedView && acceptedCollection) return acceptedCollection;

    if (currentDeletedEntry?.publishingCollectionID) {
      return {
        id: currentDeletedEntry.publishingCollectionID,
        name: currentDeletedEntry.publishingCollectionName || "Deleted collection"
      };
    }

    if (!currentPublishing || !collection) return acceptedCollection;

    const collectionID = [...collection.ancestors, collection.id].find((id) => {
      return currentPublishing.enabledCollectionIDs.has(id);
    });

    return collectionID ? content.collections.get({ collectionID }) || null : acceptedCollection;
  });
  const queryInput = () => {
    const collectionID = publishingCollection()?.id;

    return collectionID ? { channel: publishing.channel(), collectionID } : null;
  };
  const channelContent = createAsync(
    async (): Promise<PublishingPanelResponse | null> => {
      const input = queryInput();

      if (!opened() || !input || content.offline()) return null;

      try {
        return { ...input, result: await publishingChannelContentQuery(input) };
      } catch (error) {
        console.error(error);
        return { ...input, error: true };
      }
    },
    { deferStream: true, initialValue: null }
  );
  const response = () => {
    const input = queryInput();
    const latest = channelContent.latest;

    if (!input || latest?.channel !== input.channel || latest.collectionID !== input.collectionID) {
      return undefined;
    }

    return latest;
  };
  const pendingCount = () => {
    const result = response()?.result;
    const pendingEntries =
      result?.entries.filter(({ status }) => status !== "published").length || 0;
    const pendingCollections =
      result?.collections.filter(({ status }) => status !== "published").length || 0;

    return pendingCollections + pendingEntries;
  };
  const channelCodes = createMemo(() => {
    const codes = new Set<string>([PUBLISHED_CHANNEL, publishing.channel()]);

    for (const channel of publishing.channels()) codes.add(channel.code);

    return [...codes];
  });
  const headerOptions = (): MenuItem[][] => {
    const channelOptions: MenuItem[] =
      channelCodes().length > 1
        ? [
            {
              icon: "i-lucide:radio",
              label: `Channel: ${publishing.getChannelName()}`,
              items: [
                { label: "Channel", type: "header" },
                ...channelCodes().map((code) => ({
                  label: publishing.getChannelName(code),
                  selected: code === publishing.channel(),
                  onClick: () => publishing.setChannel(code)
                }))
              ]
            }
          ]
        : [];

    return [actionMenuItems(), channelOptions].filter((group) => group.length > 0);
  };
  const hasHeaderOptions = () => headerOptions().length > 0;
  const mutation = createMutation(() => ({
    mutationFn: async (input: PublishingMutationInput) => {
      if (input.action === "publish-collection") {
        await client.publishing.publishCollection({
          channel: input.channel,
          collectionID: input.targetCollectionID || input.collectionID
        });
        return;
      }

      if (input.action === "publish-selection") {
        if (input.collectionIDs?.length) {
          await client.publishing.bulkPublishCollections({
            channel: input.channel,
            ids: input.collectionIDs
          });
        }

        if (input.entryIDs?.length) {
          await client.publishing.bulkPublishEntries({
            channel: input.channel,
            entries: input.entryIDs.map((entryID) => ({ entryID }))
          });
        }

        if (input.unpublishCollectionIDs?.length) {
          await client.publishing.bulkUnpublishCollections({
            channel: input.channel,
            ids: input.unpublishCollectionIDs
          });
        }

        if (input.unpublishEntryIDs?.length) {
          await client.publishing.bulkUnpublishEntries({
            channel: input.channel,
            ids: input.unpublishEntryIDs
          });
        }

        return;
      }

      if (input.collectionIDs?.length) {
        await client.publishing.bulkUnpublishCollections({
          channel: input.channel,
          ids: input.collectionIDs
        });
      }

      if (input.entryIDs?.length) {
        await client.publishing.bulkUnpublishEntries({
          channel: input.channel,
          ids: input.entryIDs
        });
      }
    },
    onSuccess: async (_data, input) => {
      await revalidate(
        publishingChannelContentQuery.keyFor({
          channel: input.channel,
          collectionID: input.collectionID
        })
      );
      void revalidate(publishingPublicationsQuery.key);
      void revalidate(publishingExplorerOverlayQuery.keyFor({ channel: input.channel }));

      if (input.channel !== PUBLISHED_CHANNEL) {
        void revalidate(publishingStatusQuery.keyFor({ channel: input.channel }));
      }
    },
    onError: (error, input) => {
      console.error(error);
      notify({
        type: "error",
        text:
          input.action === "unpublish-selection"
            ? "Failed to unpublish content"
            : "Failed to publish content"
      });
    }
  }));
  const runMutation = (input: PublishingPanelActionInput) => {
    const collectionID = publishingCollection()?.id;

    if (!collectionID || mutation.isPending || revert.isPending()) return;

    mutation.mutate({
      channel: publishing.channel(),
      collectionID,
      ...input
    });
  };
  const revertChanges = (target: PublishingRevertTarget) => {
    const currentResponse = response();

    if (!currentResponse?.result || mutation.isPending || revert.isPending()) {
      return;
    }

    setMenuOpened(false);
    revert.run(target, {
      channel: currentResponse.channel,
      collectionID: currentResponse.collectionID,
      snapshotID: currentResponse.result.snapshotID
    });
  };

  return (
    <DropdownArea>
      <div
        ref={setScrollableContainerRef}
        data-tree-marquee
        class="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-1 scrollbar-contrast"
      >
        <div
          data-tree-interaction
          class="sticky top-0 z-20 -mx-1 flex shrink-0 flex-col bg-white px-1 md:bg-gray-100"
        >
          <div class="group/publishing-header relative flex h-9 items-center gap-2">
            <h2 class="min-w-0 flex-1 truncate text-2xl font-semibold">Publishing</h2>
            <Show when={hasHeaderOptions()}>
              <div class="absolute right-0">
                <DropdownMenu
                  title="Publishing"
                  cardProps={
                    {
                      "class": "w-52",
                      "data-tree-interaction": ""
                    } as Partial<ComponentProps<typeof Card>>
                  }
                  items={headerOptions()}
                  mobileSheetDragFromContent={false}
                  opened={menuOpened()}
                  portal={false}
                  setOpened={setMenuOpened}
                  trigger={() => (
                    <div
                      class={clsx(
                        !menuOpened() &&
                          "opacity-20 media-mouse:opacity-0 media-mouse:group-hover/publishing-header:opacity-100"
                      )}
                    >
                      <IconButton
                        aria-label="Open publishing menu"
                        icon="i-lucide:ellipsis-vertical"
                        size="small"
                        text="soft"
                        variant="text"
                      />
                    </div>
                  )}
                />
              </div>
            </Show>
          </div>
          <span class="ml-1 text-gray-400 text-xs leading-normal">
            {publishingCollection()?.name}
          </span>
        </div>
        <Show when={response()} fallback={<PublishingPanelContentSkeleton />}>
          {(currentResponse) => (
            <Show
              when={!currentResponse().error}
              fallback={
                <div class="flex flex-1 flex-col pt-1">
                  <Button
                    class="flex w-full items-center justify-start gap-1 py-0.5 pl-0.5"
                    variant="text"
                    onClick={() => {
                      const input = queryInput();

                      if (input) void revalidate(publishingChannelContentQuery.keyFor(input));
                    }}
                  >
                    <div class="flex h-6 w-6 items-center justify-center">
                      <div class="i-lucide:refresh-cw h-4.5 w-4.5 text-gray-400" />
                    </div>
                    <span class="flex-1 text-left line-clamp-1">Try again</span>
                  </Button>
                  <p class="mx-1 mt-1 text-xs text-gray-400">
                    Publishing status could not be loaded. Check your connection and try again.
                  </p>
                </div>
              }
            >
              <Show
                when={currentResponse().result && pendingCount() > 0}
                fallback={
                  <div class="flex h-7 w-full items-center gap-1 pl-0.5 font-medium">
                    <div class="flex h-6 w-6 items-center justify-center">
                      <div class="h-5 w-5 text-green-500 i-material-symbols:check-circle-outline-rounded" />
                    </div>
                    <span class="min-w-0 flex-1 line-clamp-1">No pending changes</span>
                  </div>
                }
              >
                <PublishingPanelTree
                  channel={publishing.channel()}
                  collectionID={currentResponse().collectionID}
                  content={currentResponse().result!}
                  mutationAction={revert.isPending() ? "revert" : mutation.variables?.action}
                  mutationPending={mutation.isPending || revert.isPending()}
                  revertCompleted={revertCompleted()}
                  onAction={runMutation}
                  onMenuItemsChange={setActionMenuItems}
                  onRevert={revertChanges}
                  scrollableContainer={scrollableContainerRef}
                />
              </Show>
            </Show>
          )}
        </Show>
      </div>
    </DropdownArea>
  );
};

export { PublishingPanel, PublishingPanelFallback };
