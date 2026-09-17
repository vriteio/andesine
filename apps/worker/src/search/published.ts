import {
  PUBLISHED_CHANNEL_PURGE_JOB_NAME,
  PUBLISHED_COLLECTION_SYNC_JOB_NAME,
  PUBLISHED_ENTRY_SYNC_JOB_NAME,
  PUBLISHED_WORKSPACE_PURGE_JOB_NAME,
  createPublishedEntrySyncJobs,
  type PublishedChannelPurgeJobData,
  type PublishedCollectionSyncJobData,
  type PublishedEntrySyncJobData,
  type PublishedWorkspacePurgeJobData
} from "@andesine/backend/lib/queue/search-indexing-jobs";
import {
  buildPublishedSearchDocuments,
  PUBLISHED_SEARCH_COLLECTION_ALIAS,
  type PublishedSearchDocumentWithEmbedding,
  type TypesenseClient
} from "@andesine/backend/lib/search";
import type { Queue } from "bullmq";
import type { JobHandler } from "../jobs";
import { createEmbeddings } from "./openai-compatible";
import {
  loadPublishedChannelHeadKey,
  loadPublishedCollectionEntryIDs,
  loadPublishedEntrySources
} from "./published-data";

interface PublishedSearchJobDependencies {
  queue: Queue;
  typesense: TypesenseClient;
}

const getEntryFilter = (data: PublishedEntrySyncJobData): string => {
  return `workspaceID:=${data.workspaceID} && entryID:=${data.entryID}`;
};
const getChannelFilter = (data: PublishedChannelPurgeJobData): string => {
  return `workspaceID:=${data.workspaceID} && channelID:=${data.channelID}`;
};
const getWorkspaceFilter = (data: PublishedWorkspacePurgeJobData): string => {
  return `workspaceID:=${data.workspaceID}`;
};
const createPublishedSearchJobHandlers = (
  dependencies: PublishedSearchJobDependencies
): Map<string, JobHandler> => {
  const handlers = new Map<string, JobHandler>();

  handlers.set(PUBLISHED_ENTRY_SYNC_JOB_NAME, async (job) => {
    const data = job.data as unknown as PublishedEntrySyncJobData;
    const channelHeadKey = await loadPublishedChannelHeadKey(data.workspaceID);
    const sources = await loadPublishedEntrySources(data);
    const builtDocuments = sources.flatMap((source) => buildPublishedSearchDocuments(source));
    const retryIfChannelAdvanced = async (): Promise<boolean> => {
      const currentChannelHeadKey = await loadPublishedChannelHeadKey(data.workspaceID);

      if (currentChannelHeadKey === channelHeadKey) return false;

      await dependencies.queue.addBulk(
        createPublishedEntrySyncJobs({ workspaceID: data.workspaceID, entryIDs: [data.entryID] })
      );
      return true;
    };

    if (await retryIfChannelAdvanced()) return;

    if (builtDocuments.length === 0) {
      await dependencies.typesense.deleteDocuments(
        PUBLISHED_SEARCH_COLLECTION_ALIAS,
        getEntryFilter(data)
      );
      await retryIfChannelAdvanced();
      return;
    }

    const embeddings = await createEmbeddings(
      builtDocuments.map(({ embeddingText }) => embeddingText)
    );
    const documents: PublishedSearchDocumentWithEmbedding[] = builtDocuments.map(
      ({ document }, index) => ({
        ...document,
        embedding: embeddings[index]!
      })
    );

    await dependencies.typesense.deleteDocuments(
      PUBLISHED_SEARCH_COLLECTION_ALIAS,
      getEntryFilter(data)
    );
    await dependencies.typesense.importDocuments(PUBLISHED_SEARCH_COLLECTION_ALIAS, documents);
    await retryIfChannelAdvanced();
  });
  handlers.set(PUBLISHED_COLLECTION_SYNC_JOB_NAME, async (job) => {
    const data = job.data as unknown as PublishedCollectionSyncJobData;
    const entryIDs = await loadPublishedCollectionEntryIDs(data);
    const jobs = createPublishedEntrySyncJobs({ workspaceID: data.workspaceID, entryIDs });

    if (jobs.length > 0) await dependencies.queue.addBulk(jobs);
  });
  handlers.set(PUBLISHED_CHANNEL_PURGE_JOB_NAME, async (job) => {
    const data = job.data as unknown as PublishedChannelPurgeJobData;

    await dependencies.typesense.deleteDocuments(
      PUBLISHED_SEARCH_COLLECTION_ALIAS,
      getChannelFilter(data)
    );
  });
  handlers.set(PUBLISHED_WORKSPACE_PURGE_JOB_NAME, async (job) => {
    const data = job.data as unknown as PublishedWorkspacePurgeJobData;

    await dependencies.typesense.deleteDocuments(
      PUBLISHED_SEARCH_COLLECTION_ALIAS,
      getWorkspaceFilter(data)
    );
  });

  return handlers;
};

export { createPublishedSearchJobHandlers };
