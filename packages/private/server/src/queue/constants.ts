import type { DefaultJobOptions } from "bullmq";

const SEARCH_INDEXING_QUEUE_NAME = "search-indexing";
// Retries span about 40 minutes, so a search service restart doesn't drop changes; jobs read
// the current data when they run, so a late retry doesn't index stale content.
const SEARCH_INDEXING_DEFAULT_JOB_OPTIONS = {
  attempts: 10,
  backoff: {
    type: "exponential",
    delay: 5000
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1000
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5000
  }
} satisfies DefaultJobOptions;

export { SEARCH_INDEXING_DEFAULT_JOB_OPTIONS, SEARCH_INDEXING_QUEUE_NAME };
