import * as z from "zod";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().min(1).optional()
);
const positiveInteger = (defaultValue: number, maximum = Number.MAX_SAFE_INTEGER) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(maximum).default(defaultValue)
  );
const assetConfigSchema = z.object({
  ASSET_S3_BUCKET: optionalString,
  ASSET_S3_REGION: optionalString,
  ASSET_S3_ENDPOINT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url().optional()
  ),
  ASSET_S3_ACCESS_KEY_ID: optionalString,
  ASSET_S3_SECRET_ACCESS_KEY: optionalString,
  ASSET_S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  ASSET_MAX_UPLOAD_BYTES: positiveInteger(10 * 1024 ** 2, 64 * 1024 ** 2),
  ASSET_MAX_INPUT_PIXELS: positiveInteger(25_000_000, 100_000_000),
  ASSET_STORAGE_BYTES: positiveInteger(10 * 1024 ** 3),
  PRO_ASSET_STORAGE_BYTES: positiveInteger(50 * 1024 ** 3),
  ASSET_UPLOAD_EXPIRY_HOURS: positiveInteger(3, 168),
  ASSET_RETENTION_DAYS: positiveInteger(7)
});

type AssetConfig = z.infer<typeof assetConfigSchema>;

export { assetConfigSchema };
export type { AssetConfig };
