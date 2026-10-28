import { DelayedError, type Job } from "bullmq";

interface BackgroundJobData {
  [key: string]: unknown;
}

type BackgroundJob = Job<BackgroundJobData, void, string>;
type JobHandler = (job: BackgroundJob) => Promise<void>;

const UNKNOWN_JOB_RETRY_MS = 30_000;
const UNKNOWN_JOB_MAX_AGE_MS = 10 * 60_000;
const processJob = async (
  job: BackgroundJob,
  jobHandlers: Map<string, JobHandler>,
  token?: string
): Promise<void> => {
  const handler = jobHandlers.get(job.name);

  if (!handler) {
    const retryable = Boolean(token) && Date.now() - job.timestamp < UNKNOWN_JOB_MAX_AGE_MS;

    // During a deploy, a newer instance can add jobs that this older one doesn't know yet.
    if (retryable) {
      await job.moveToDelayed(Date.now() + UNKNOWN_JOB_RETRY_MS, token);
      throw new DelayedError();
    }

    throw new Error(`Unsupported background job: ${job.name}`);
  }

  await handler(job);
};

export { processJob };
export type { BackgroundJob, JobHandler };
