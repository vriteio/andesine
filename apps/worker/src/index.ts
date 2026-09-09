import { indexAssetSearch } from "./assets/search";
import { analyzeAsset, scheduleAssetAnalyses } from "./assets/analyze";
import { processProfileImage } from "./assets/process-profile";
import { createAssetStorage } from "@andesine/backend/lib/assets/storage";
import {
  ASSET_ANALYSIS_JOB_NAME,
  ASSET_PROCESS_JOB_NAME,
  PROFILE_IMAGE_JOB_NAME,
  type ProfileImageJobData,
  type AssetProcessJobData
} from "@andesine/backend/lib/queue/asset-jobs";
import { processAsset } from "./assets/process";
import { maintainAssets } from "./assets/maintenance";
import {
  SEARCH_INDEXING_DEFAULT_JOB_OPTIONS,
  SEARCH_INDEXING_QUEUE_NAME
} from "@andesine/backend/lib/queue/constants";
import {
  SCHEMA_MIGRATION_JOB_NAME,
  type SchemaMigrationJobData
} from "@andesine/backend/lib/queue/schema-migration-jobs";
import {
  createSearchCollectionDefinitions,
  ensureSearchCollections,
  TypesenseClient
} from "@andesine/backend/lib/search";
import { Queue, Worker, createNodeRedisClient } from "bullmq";
import { createClient } from "redis";
import { config } from "./config";
import { processJob } from "./jobs";
import { pool } from "./database";
import { createCurrentSearchJobHandlers } from "./search/current";
import { createPublishedSearchJobHandlers } from "./search/published";
import {
  createSchemaMigrationJobHandlers,
  recoverAbandonedSchemaMigrations,
  reconcileFailedSchemaMigrationJob
} from "./schema-migrations";

const MAINTENANCE_QUEUE_NAME = "maintenance";
const MAINTENANCE_INTERVAL_MS = 60_000;
const queueRedisClient = createClient({ url: config.QUEUE_REDIS_URL });
const queueRedisConnection = createNodeRedisClient(queueRedisClient);
const eventsRedisClient = createClient({ url: config.REDIS_URL });
const typesenseClient = new TypesenseClient({
  url: config.TYPESENSE_URL,
  apiKey: config.TYPESENSE_API_KEY
});
const searchIndexingQueue = new Queue(SEARCH_INDEXING_QUEUE_NAME, {
  connection: queueRedisConnection,
  defaultJobOptions: SEARCH_INDEXING_DEFAULT_JOB_OPTIONS,
  skipWaitingForReady: true
});
const maintenanceQueue = new Queue(MAINTENANCE_QUEUE_NAME, {
  connection: queueRedisConnection,
  defaultJobOptions: SEARCH_INDEXING_DEFAULT_JOB_OPTIONS,
  skipWaitingForReady: true
});
const jobDependencies = {
  queue: searchIndexingQueue,
  typesense: typesenseClient
};
const schemaMigrationDependencies = {
  queue: searchIndexingQueue,
  publish: (channel: string, message: string) => eventsRedisClient.publish(channel, message)
};
const jobHandlers = new Map([
  ...createCurrentSearchJobHandlers(jobDependencies),
  ...createPublishedSearchJobHandlers(jobDependencies),
  ...createSchemaMigrationJobHandlers(schemaMigrationDependencies)
]);
const maintenanceHandlers = new Map([
  ["schema-migration-recovery", () => recoverAbandonedSchemaMigrations(searchIndexingQueue)]
]);
const assetStorage = createAssetStorage(config);
if (assetStorage) {
  maintenanceHandlers.set("asset-search-indexing", () => indexAssetSearch(typesenseClient));
  jobHandlers.set(ASSET_ANALYSIS_JOB_NAME, (job) =>
    analyzeAsset(job.data.assetID as string, assetStorage)
  );
  maintenanceHandlers.set("asset-analysis-recovery", () =>
    scheduleAssetAnalyses(searchIndexingQueue)
  );
  jobHandlers.set(PROFILE_IMAGE_JOB_NAME, (job) =>
    processProfileImage(job.data as unknown as ProfileImageJobData, assetStorage)
  );
  jobHandlers.set(ASSET_PROCESS_JOB_NAME, (job) =>
    processAsset(job.data as unknown as AssetProcessJobData, assetStorage)
  );
  maintenanceHandlers.set("asset-maintenance", () =>
    maintainAssets(searchIndexingQueue, assetStorage, typesenseClient)
  );
}
const worker = new Worker(SEARCH_INDEXING_QUEUE_NAME, (job) => processJob(job, jobHandlers), {
  autorun: false,
  connection: queueRedisConnection,
  concurrency: config.WORKER_CONCURRENCY
});
const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE_NAME,
  (job) => processJob(job, maintenanceHandlers),
  { autorun: false, connection: queueRedisConnection, concurrency: 1 }
);

queueRedisClient.on("error", (error) => {
  console.error("Worker Redis client error", { error });
});
eventsRedisClient.on("error", (error) => {
  console.error("Worker event Redis client error", { error });
});
maintenanceQueue.on("error", (error) => {
  console.error("Maintenance queue error", { error });
});
maintenanceWorker.on("error", (error) => {
  console.error("Maintenance worker error", { error });
});
maintenanceWorker.on("failed", (job, error) => {
  console.error("Maintenance job failed", { error, jobId: job?.id, jobName: job?.name });
});
worker.on("error", (error) => {
  console.error("Background worker error", { error });
});
worker.on("failed", (job, error) => {
  console.error("Background job failed", {
    error,
    jobId: job?.id,
    jobName: job?.name
  });

  if (job?.name !== SCHEMA_MIGRATION_JOB_NAME || !job.finishedOn) return;

  const data = job.data as unknown as SchemaMigrationJobData;

  void reconcileFailedSchemaMigrationJob(
    {
      error,
      migrationID: data.migrationID,
      workspaceID: data.workspaceID
    },
    schemaMigrationDependencies
  ).catch((reconciliationError) => {
    console.error("Failed to reconcile exhausted schema migration job", {
      error: reconciliationError,
      migrationID: data.migrationID
    });
  });
});

await Promise.all([
  worker.waitUntilReady(),
  maintenanceWorker.waitUntilReady(),
  eventsRedisClient.connect(),
  ensureSearchCollections(
    typesenseClient,
    createSearchCollectionDefinitions({
      dimensions: config.SEARCH_EMBEDDING_DIMENSIONS
    })
  )
]);
// Set the shared limit before any replica starts consuming maintenance jobs.
await maintenanceQueue.setGlobalConcurrency(1);
for (const name of maintenanceHandlers.keys()) {
  await maintenanceQueue.upsertJobScheduler(
    name,
    { every: MAINTENANCE_INTERVAL_MS },
    { name, data: {}, opts: SEARCH_INDEXING_DEFAULT_JOB_OPTIONS }
  );
}
void worker.run().catch((error) => {
  worker.emit("error", error);
});
void maintenanceWorker.run().catch((error) => {
  maintenanceWorker.emit("error", error);
});

console.log("Background worker is ready");

let shutdownPromise: Promise<void> | undefined;
const shutdown = (): Promise<void> => {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    let exitCode = 0;

    // Finish maintenance while its target queue and database are still available.
    try {
      await maintenanceWorker.close();
    } catch (error) {
      exitCode = 1;
      console.error("Failed to close the maintenance worker", error);
    }

    try {
      await maintenanceQueue.close();
    } catch (error) {
      exitCode = 1;
      console.error("Failed to close the maintenance queue", error);
    }

    try {
      await worker.close();
    } catch (error) {
      exitCode = 1;
      console.error("Failed to close the background worker", error);
    }

    try {
      await searchIndexingQueue.close();
    } catch (error) {
      exitCode = 1;
      console.error("Failed to close the search indexing queue", error);
    }

    if (queueRedisClient.isOpen) {
      try {
        await queueRedisConnection.quit();
      } catch (error) {
        exitCode = 1;
        console.error("Failed to close the worker Redis connection", error);
      }
    }

    if (eventsRedisClient.isOpen) {
      try {
        await eventsRedisClient.close();
      } catch (error) {
        exitCode = 1;
        console.error("Failed to close the worker event Redis connection", error);
      }
    }

    try {
      await pool.end();
    } catch (error) {
      exitCode = 1;
      console.error("Failed to close the worker database pool", error);
    }

    process.exit(exitCode);
  })();

  return shutdownPromise;
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
