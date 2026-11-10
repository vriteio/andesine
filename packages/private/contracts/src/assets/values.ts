import * as z from "zod";

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 ** 2;
const assetStatusType = z.enum(["pending", "processing", "ready", "failed", "deleting"]);
const assetAnalysisStatusType = z.enum(["pending", "processing", "ready", "failed"]);
const assetFileFormatType = z.enum(["jpeg", "png", "webp"]);

export { DEFAULT_MAX_UPLOAD_BYTES, assetStatusType, assetAnalysisStatusType, assetFileFormatType };
