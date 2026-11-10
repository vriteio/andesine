import { isIP } from "node:net";
import * as z from "zod";

type WebhookDestinationConfig = z.infer<typeof webhookDestinationConfigSchema>;

const exceptionType = z.strictObject({
  origin: z
    .string()
    .max(2048)
    .refine((value) => {
      if (!URL.canParse(value)) return false;

      const url = new URL(value);

      return ["http:", "https:"].includes(url.protocol) && url.origin === value;
    }, "Use an exact, canonical HTTP(S) origin without a path"),
  addresses: z
    .array(z.string().refine((value) => isIP(value) !== 0, "Use an IP address"))
    .min(1)
    .max(16)
});
const webhookDestinationConfigSchema = z.object({
  WEBHOOK_ALLOW_HTTP: z.stringbool().default(false),
  WEBHOOK_DESTINATION_EXCEPTIONS: z.preprocess(
    (value) => {
      if (value === undefined || value === "") return [];
      if (typeof value !== "string") return value;

      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
    z
      .array(exceptionType)
      .max(32)
      .refine(
        (items) => new Set(items.map(({ origin }) => origin)).size === items.length,
        "Destination exception origins must be unique"
      )
  )
});

export { webhookDestinationConfigSchema };
export type { WebhookDestinationConfig };
