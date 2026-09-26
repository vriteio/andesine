import type { JobsOptions } from "bullmq";

interface WebhookJobData {
  workspaceID: string;
  runID: string;
}
interface WebhookJob {
  name: string;
  data: WebhookJobData;
  opts: JobsOptions;
}

const WEBHOOK_QUEUE_NAME = "webhooks";
const WEBHOOK_JOB_NAME = "deliver-webhook";
const createWebhookJob = (data: WebhookJobData, nextAttemptAt: string): WebhookJob => ({
  name: WEBHOOK_JOB_NAME,
  data: { workspaceID: data.workspaceID, runID: data.runID },
  opts: {
    // A later DB due time must not be blocked by an old Redis job still marked active.
    jobId: `webhook-${data.runID}-${new Date(nextAttemptAt).getTime()}`,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true
  }
});

export { createWebhookJob, WEBHOOK_QUEUE_NAME, WEBHOOK_JOB_NAME };
export type { WebhookJobData };
