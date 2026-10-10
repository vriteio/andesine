import * as z from "zod";

const extensionsConfigSchema = z.object({
  PUBLIC_EXTENSIONS_ENABLED: z
    .stringbool()
    .default(false)
    .describe("Whether extensions are available; the web app must use the same value"),
  MAX_EXTENSIONS_PER_WORKSPACE: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Installed extensions per workspace, including development extensions"),
  EXTENSIONS_REGISTRY_URL: z
    .url({ protocol: /^https$/ })
    .optional()
    .describe(
      "HTTPS URL of the extension registry index; without it, the registry never refreshes"
    ),
  EXTENSIONS_REGISTRY_REFRESH_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .default(300)
    .describe("Seconds between registry refreshes; key and version revocations apply on refresh"),
  EXTENSIONS_DEVELOPMENT_ENABLED: z
    .stringbool()
    .default(false)
    .describe(
      "Whether members can run development extensions (`andesine extensions dev`); local instances only"
    )
});

export { extensionsConfigSchema };
