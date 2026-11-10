import * as z from "zod";

const versionRetentionConfigSchema = z.object({
  VERSION_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .default(7)
    .describe("Number of days to keep automatic versions by default"),
  PRO_VERSION_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .default(30)
    .describe("Number of days to keep automatic versions on the Pro plan")
});

export { versionRetentionConfigSchema };
