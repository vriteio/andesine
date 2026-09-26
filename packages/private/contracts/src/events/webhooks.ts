import { id, publicID } from "../primitives/id";
import * as z from "zod";

const webhookEventDataType = z.object({ id: publicID("wh") });
const webhookEventType = z.union([
  z.object({
    action: z.literal("webhook:create"),
    memberID: id().optional(),
    data: webhookEventDataType
  }),
  z.object({
    action: z.literal("webhook:update"),
    memberID: id().optional(),
    data: webhookEventDataType
  }),
  z.object({
    action: z.literal("webhook:delete"),
    memberID: id().optional(),
    data: webhookEventDataType
  })
]);
type WebhookEvent = z.infer<typeof webhookEventType>;
export { webhookEventType };
export type { WebhookEvent };
