import { WEBHOOK_JOB_NAME, WEBHOOK_QUEUE_NAME } from "@andesine/server/queue";
import { createSecretEncryption } from "@andesine/server/security";
import { claimDeliveryRun, finishDeliveryAttempt } from "@andesine/server/webhooks/delivery";
import { randomUUID } from "node:crypto";
import { publicID } from "@andesine/contracts/primitives";
import { Worker, createNodeRedisClient, type Job } from "bullmq";
import { createClient } from "redis";
import * as z from "zod";
import { config } from "../config";
import { db } from "../database";
import { dispatchWebhookHTTP } from "./dispatch";
import { publishWebhookUpdate, type PublishEvent } from "./events";

interface WebhookConsumer {
  stop: () => Promise<void>;
}

const jobDataType = z.strictObject({ workspaceID: publicID("ws"), runID: publicID("whrun") });
const WEBHOOK_CONSUMER_RESTART_MS = 10_000;
const startWebhookConsumer = (publish: PublishEvent): WebhookConsumer => {
  const workerID = `webhooks-${randomUUID()}`;
  const encryption = createSecretEncryption(config.ENCRYPTION_KEYS);
  const active = new Set<Promise<void>>();

  let worker: Worker | undefined;
  let connection: ReturnType<typeof createNodeRedisClient> | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopping: Promise<void> | undefined;
  let stopped = false;

  const deliver = async (job: Job): Promise<void> => {
    if (stopped) return;
    if (job.name !== WEBHOOK_JOB_NAME) throw new Error("Unknown webhook job");

    const identity = jobDataType.parse(job.data);
    const claim = await claimDeliveryRun(db, {
      ...identity,
      workerID,
      globalConcurrency: config.WEBHOOK_GLOBAL_CONCURRENCY,
      workspaceConcurrency: config.WEBHOOK_WORKSPACE_CONCURRENCY
    });

    // A busy, stale or ineligible run is safe to acknowledge. PostgreSQL scans
    // rediscover pending work; queue retries must never be the delivery policy.
    if (!claim) return;

    const result = stopped
      ? {
          outcome: "platform_failure" as const,
          durationMs: 0,
          httpStatus: null,
          failureCategory: "internal" as const,
          retryAfterAt: null,
          stopReason: null
        }
      : await dispatchWebhookHTTP({
          database: db,
          claim,
          encryption,
          config,
          instance: config.PUBLIC_API_URL
        });

    // If completion fails, preserve the lease for unknown-outcome recovery.
    // Never send again from this processor or fabricate a receiver failure.
    const status = await finishDeliveryAttempt(db, {
      ...identity,
      leaseToken: claim.leaseToken,
      result
    });

    // Health, counts, and automatic disabling change with each applied attempt.
    if (status === "applied") publishWebhookUpdate(publish, identity.workspaceID, claim.endpointID);
  };
  const processJob = (job: Job): Promise<void> => {
    const task = deliver(job);

    active.add(task);
    void task.then(
      () => active.delete(task),
      () => active.delete(task)
    );
    return task;
  };
  const start = (): void => {
    if (stopped) return;

    const redis = createClient({ url: config.QUEUE_REDIS_URL, disableOfflineQueue: true });
    const currentConnection = createNodeRedisClient(redis);
    const currentWorker = new Worker(WEBHOOK_QUEUE_NAME, processJob, {
      connection: currentConnection,
      autorun: false,
      concurrency: config.WEBHOOK_WORKER_CONCURRENCY
    });

    connection = currentConnection;
    worker = currentWorker;
    currentConnection.on("error", () => {
      if (!stopped) console.error("Webhook consumer Redis connection failed");
    });
    currentWorker.on("error", () => {
      if (!stopped) console.error("Webhook consumer failed");
    });
    currentWorker.on("failed", () => {
      // Queue data and raw database errors can contain untrusted or private data.
      if (!stopped) console.error("Webhook job failed; database recovery will retry eligible work");
    });
    running = currentWorker
      .run()
      .catch(() => {
        if (!stopped) console.error("Webhook consumer stopped unexpectedly");
      })
      .finally(async () => {
        currentConnection.disconnect();
        await currentWorker.close(true).catch(() => {
          console.error("Failed to close webhook consumer");
        });
        await Promise.allSettled([...active]);
        if (!stopped) timer = setTimeout(start, WEBHOOK_CONSUMER_RESTART_MS);
      });
  };
  const stop = (): Promise<void> => {
    if (stopping) return stopping;

    stopped = true;
    clearTimeout(timer);
    stopping = (async () => {
      // Stop Redis admission immediately, including during an outage. Processors
      // finish separately so HTTP results can commit before the pool is closed.
      const closing = worker?.close(true);

      connection?.disconnect();
      await closing;
      await running;
      await Promise.allSettled([...active]);
    })();

    return stopping;
  };

  start();
  return { stop };
};

export { startWebhookConsumer };
