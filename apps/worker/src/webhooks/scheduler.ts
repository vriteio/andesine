import { createWebhookJob, WEBHOOK_QUEUE_NAME } from "@andesine/backend/lib/queue/webhook-jobs";
import {
  scanDeliveryRuns,
  type DeliveryScanCursor
} from "@andesine/backend/lib/webhooks/delivery/scan";
import { recoverDeliveryRun } from "@andesine/backend/lib/webhooks/delivery/recover";
import { Queue, createNodeRedisClient } from "bullmq";
import { createClient } from "redis";
import { config } from "../config";
import { db } from "../database";

interface WebhookScheduler {
  stop: () => Promise<void>;
}

const WEBHOOK_SCAN_INTERVAL_MS = 10_000;
const startWebhookScheduler = (): WebhookScheduler => {
  const redis = createClient({
    url: config.QUEUE_REDIS_URL,
    disableOfflineQueue: true,
    commandOptions: { timeout: 5_000 }
  });
  const connection = createNodeRedisClient(redis);

  let queue: Queue | undefined;
  let cursor: DeliveryScanCursor | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let stopped = false;

  const getQueue = async (): Promise<Queue> => {
    if (!queue) {
      queue = new Queue(WEBHOOK_QUEUE_NAME, { connection, skipWaitingForReady: true });
      queue.on("error", () => {
        if (!stopped) console.error("Webhook queue failed");
      });

      try {
        await queue.waitUntilReady();
      } catch (error) {
        const failedQueue = queue;

        queue = undefined;
        await failedQueue.close();
        throw error;
      }
    }

    return queue;
  };
  const scan = async (): Promise<void> => {
    const page = await scanDeliveryRuns(db, cursor);

    if (!page.acquired) return;

    cursor = page.cursor;

    let queueAvailable = redis.isReady;

    for (const run of page.abandoned) {
      if (stopped) return;

      try {
        await recoverDeliveryRun(db, run);
      } catch {
        console.error("Failed to recover webhook lease", { runID: run.runID });
      }
    }

    for (const run of page.due) {
      if (stopped) return;

      try {
        const stoppedRun = await recoverDeliveryRun(db, run);

        if (stoppedRun || !queueAvailable || !redis.isReady) continue;

        const job = createWebhookJob(run, run.nextAttemptAt);
        const currentQueue = await getQueue();

        await currentQueue.add(job.name, job.data, job.opts);
      } catch {
        // One failed queue operation is enough for this sweep. Keep reconciling
        // database rows without repeating a timeout for every due run.
        queueAvailable = false;
        console.error("Failed to schedule webhook delivery", { runID: run.runID });
      }
    }
  };
  const tick = (): void => {
    running = scan()
      .catch(() => {
        console.error("Webhook database scan failed");
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, WEBHOOK_SCAN_INTERVAL_MS);
      });
  };
  const stop = (): Promise<void> => {
    if (stopping) return stopping;

    stopped = true;
    clearTimeout(timer);
    stopping = (async () => {
      // Interrupt pending queue calls before awaiting the scan during a Redis outage.
      connection.disconnect();

      await running;
      await queue?.close();
    })();

    return stopping;
  };

  connection.on("error", () => {
    if (!stopped) console.error("Webhook Redis connection failed");
  });
  tick();

  return { stop };
};

export { startWebhookScheduler };
