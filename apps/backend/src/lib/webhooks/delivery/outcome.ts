import type { DeliveryStopReason } from "./state";
import { outboundRunStopReasonEnum } from "#backend/db/outbound-deliveries";
import { webhookFailureCategoryEnum } from "#backend/db/webhooks";
import * as z from "zod";

interface DeliveryAttemptResult {
  outcome: "succeeded" | "receiver_failure" | "platform_failure" | "unknown";
  durationMs: number;
  httpStatus: number | null;
  failureCategory: "http_status" | "network" | "timeout" | "destination_policy" | "internal" | null;
  retryAfterAt: Date | null;
  stopReason: DeliveryStopReason | null;
}

const deliveryAttemptResultType = z
  .strictObject({
    outcome: z.enum(["succeeded", "receiver_failure", "platform_failure", "unknown"]),
    durationMs: z.number().int().min(0).max(2_147_483_647),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    failureCategory: z.enum(webhookFailureCategoryEnum.enumValues).nullable(),
    retryAfterAt: z.date().nullable(),
    stopReason: z.enum(outboundRunStopReasonEnum.enumValues).nullable()
  })
  .refine((result) => {
    const successStatus =
      result.httpStatus !== null && result.httpStatus >= 200 && result.httpStatus < 300;

    if (result.outcome === "succeeded") {
      return (
        successStatus &&
        result.failureCategory === null &&
        result.retryAfterAt === null &&
        result.stopReason === null
      );
    }

    if (result.outcome === "unknown") {
      return (
        result.httpStatus === null &&
        result.failureCategory === null &&
        result.retryAfterAt === null &&
        result.stopReason === null
      );
    }

    if (result.outcome === "platform_failure") {
      return (
        result.httpStatus === null &&
        result.retryAfterAt === null &&
        result.stopReason !== "test_completed" &&
        (result.failureCategory === "internal" ||
          result.failureCategory === "destination_policy") &&
        (result.failureCategory !== "destination_policy" ||
          result.stopReason === "destination_policy")
      );
    }

    if (result.stopReason !== null) return false;

    if (result.failureCategory === "http_status") {
      return result.httpStatus !== null && !successStatus;
    }

    return (
      result.httpStatus === null &&
      result.retryAfterAt === null &&
      (result.failureCategory === "network" || result.failureCategory === "timeout")
    );
  }, "Invalid delivery attempt result");

export { deliveryAttemptResultType };
export type { DeliveryAttemptResult };
