import { revalidate, useNavigate, useSearchParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { useNotify } from "#web/context/notifications";
import { usePublishing } from "#web/context/publishing";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import {
  entryDraftQuery,
  publishingChannelContentQuery,
  publishingExplorerOverlayQuery,
  publishingPublicationsQuery,
  publishingStatusQuery,
  versionHistoryQuery
} from "#web/lib/data";
import { type PublishingRevertTarget } from "./revert";
import { withWorkspacePanelParams } from "../panel-navigation";

interface PublishingRevertContext {
  channel: string;
  collectionID: string;
  snapshotID: string;
}
interface PublishingRevertMutationInput extends PublishingRevertContext {
  target: PublishingRevertTarget;
}
interface UsePublishingRevertInput {
  currentEntryID(): string;
  snapshotView(): boolean;
  onCompleted(): void;
}

const isConflictError = (error: unknown) => {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "CONFLICT"
  );
};
const usePublishingRevert = (props: UsePublishingRevertInput) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notify = useNotify();
  const publishing = usePublishing();
  const { content, workspaceID } = useWorkspace();
  const getFallbackEntryID = (deletedEntryIDs: string[]) => {
    const deletedIDs = new Set(deletedEntryIDs);
    const currentEntry = content.entries.get({ entryID: props.currentEntryID() });
    const entries = content.entriesCollection().find().fetch();
    const sameCollectionEntries = currentEntry
      ? content.entries.getInCollection({ collectionID: currentEntry.collectionID || null })
      : [];

    return [...sameCollectionEntries, ...entries].find(({ id }) => !deletedIDs.has(id))?.id;
  };
  const refresh = async (
    mutationInput: PublishingRevertMutationInput,
    result: Awaited<ReturnType<typeof client.publishing.revertChanges>>
  ) => {
    const affectedEntryIDs = new Set([
      ...mutationInput.target.entryIDs,
      ...result.affectedEntryIDs
    ]);

    await Promise.allSettled([
      revalidate(
        publishingChannelContentQuery.keyFor({
          channel: mutationInput.channel,
          collectionID: mutationInput.collectionID
        })
      ),
      revalidate(publishingExplorerOverlayQuery.keyFor({ channel: mutationInput.channel })),
      revalidate(publishingStatusQuery.keyFor({ channel: mutationInput.channel }))
    ]);
    for (const entryID of affectedEntryIDs) {
      void revalidate(publishingPublicationsQuery.keyFor({ entryID }));
      void revalidate(entryDraftQuery.keyFor({ id: entryID }));
    }
    for (const entryID of result.versionedEntryIDs) {
      void revalidate(versionHistoryQuery.keyFor({ entryID, limit: 50 }));
    }
  };
  const mutation = createMutation(() => ({
    mutationFn: (mutationInput: PublishingRevertMutationInput) => {
      const selection = mutationInput.target.all
        ? { all: true as const }
        : {
            collectionIDs: mutationInput.target.collectionIDs,
            entryIDs: mutationInput.target.entryIDs
          };

      return client.publishing.revertChanges({
        channel: mutationInput.channel,
        collectionID: mutationInput.collectionID,
        snapshotID: mutationInput.snapshotID,
        ...selection
      });
    },
    onSuccess: async (result, mutationInput) => {
      const currentEntryID = props.currentEntryID();
      const fallbackEntryID = result.deletedEntryIDs.includes(currentEntryID)
        ? getFallbackEntryID(result.deletedEntryIDs)
        : undefined;

      try {
        props.onCompleted();
        await refresh(mutationInput, result);

        if (result.deletedEntryIDs.includes(currentEntryID)) {
          navigate(
            withWorkspacePanelParams(
              fallbackEntryID ? `/${workspaceID()}/${fallbackEntryID}` : `/${workspaceID()}`,
              searchParams
            ),
            { replace: true }
          );
        } else if (result.restoredEntryIDs.includes(currentEntryID) && props.snapshotView()) {
          navigate(withWorkspacePanelParams(`/${workspaceID()}/${currentEntryID}`, searchParams), {
            replace: true
          });
        }

        notify({
          type: "success",
          text: result.noOp ? "Pending changes were already current" : "Pending changes reverted"
        });
      } finally {
        publishing.stopReverting(mutationInput.target);
      }
    },
    onError: async (error, mutationInput) => {
      console.error(error);
      publishing.stopReverting(mutationInput.target);
      if (isConflictError(error)) {
        await revalidate(
          publishingChannelContentQuery.keyFor({
            channel: mutationInput.channel,
            collectionID: mutationInput.collectionID
          })
        );
        notify({
          type: "info",
          text: "Publishing changes were updated. Review the refreshed list and try again."
        });
        return;
      }

      notify({ type: "error", text: "Failed to revert pending changes" });
    }
  }));
  const run = (target: PublishingRevertTarget, context: PublishingRevertContext) => {
    if (!target.canRevert || mutation.isPending) return;

    publishing.startReverting(target);
    mutation.mutate({ ...context, target });
  };

  return {
    isPending: () => mutation.isPending,
    run
  };
};

export { usePublishingRevert };
