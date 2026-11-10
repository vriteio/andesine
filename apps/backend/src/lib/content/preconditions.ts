import { ORPCError } from "@orpc/server";

/**
 * Applies a write only when a field still has the value that the caller read.
 * @throws CONTENT_PRECONDITION_FAILED with the current value.
 */
const assertExpectedValue = (
  field: string,
  expected: string | null | undefined,
  current: string | null
): void => {
  if (expected === undefined || expected === current) return;

  throw new ORPCError("CONTENT_PRECONDITION_FAILED", {
    status: 409,
    message: `The ${field} changed since it was read`,
    data: {
      field,
      current,
      hints: ["Read the item again, check that the change still applies, and retry."]
    }
  });
};

export { assertExpectedValue };
