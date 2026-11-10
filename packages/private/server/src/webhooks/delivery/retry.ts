import { randomInt } from "node:crypto";

interface DeliveryRetryInput {
  attemptNumber: number;
  now: Date;
  deadlineAt: Date;
  retryAfterAt: Date | null;
}

const WEBHOOK_RETRY_INITIAL_MS = 10_000;
const WEBHOOK_RETRY_MAX_MS = 6 * 60 * 60 * 1000;
const getDeliveryRetryTime = (input: DeliveryRetryInput): Date | null => {
  const { attemptNumber, now, deadlineAt, retryAfterAt } = input;

  if (
    !Number.isSafeInteger(attemptNumber) ||
    attemptNumber < 1 ||
    !Number.isFinite(+now) ||
    !Number.isFinite(+deadlineAt) ||
    (retryAfterAt !== null && !Number.isFinite(+retryAfterAt))
  ) {
    throw new Error("Invalid delivery retry input");
  }

  const base = Math.min(
    WEBHOOK_RETRY_MAX_MS,
    WEBHOOK_RETRY_INITIAL_MS * 2 ** Math.min(attemptNumber - 1, 12)
  );
  const minimum = Math.max(WEBHOOK_RETRY_INITIAL_MS, Math.floor(base * 0.8));
  const maximum = Math.min(WEBHOOK_RETRY_MAX_MS, Math.ceil(base * 1.2));
  const next = Math.max(+now + randomInt(minimum, maximum + 1), retryAfterAt ? +retryAfterAt : 0);

  // A receiver hint can exceed the backoff cap, but cannot extend this run.
  return next < +deadlineAt ? new Date(next) : null;
};

export { getDeliveryRetryTime, WEBHOOK_RETRY_INITIAL_MS, WEBHOOK_RETRY_MAX_MS };
