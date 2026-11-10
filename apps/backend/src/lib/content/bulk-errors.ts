import { ORPCError } from "@orpc/server";

/**
 * Names the failing item of a bulk call in an API error; calls with one item keep the message.
 * @param data Replaces the error data, for hints that only apply to bulk calls.
 */
const withItemIndex = (error: unknown, index: number, count: number, data?: unknown): unknown => {
  if (!(error instanceof ORPCError)) return error;
  if (count < 2 && data === undefined) return error;

  return new ORPCError(error.code, {
    status: error.status,
    message: count < 2 ? error.message : `Item ${index}: ${error.message}`,
    data: data ?? error.data,
    cause: error
  });
};

export { withItemIndex };
