import { assetAnalysisStatusEnum, assetFileFormatEnum, assetStatusEnum } from "#backend/db/assets";
import { assetDeliveryVariants } from "#backend/lib/assets/files";
import { publicID } from "#backend/lib/primitives";
import * as z from "zod";

const assetStatusType = z.enum(assetStatusEnum.enumValues);
const assetAnalysisStatusType = z.enum(assetAnalysisStatusEnum.enumValues);
const assetFileFormatType = z.enum(assetFileFormatEnum.enumValues);
const assetVariantType = z.enum(assetDeliveryVariants);
const assetHeadersType = z.object({
  "Cache-Control": z.literal("private, no-store")
});
const assetSearchResultType = z.object({
  assetID: publicID("ast"),
  entryID: publicID("ent"),
  entryName: z.string(),
  filename: z.string(),
  description: z.string(),
  thumbnailURL: z.url(),
  width: z.number(),
  height: z.number()
});
const assetAnalysisType = z.object({
  status: assetAnalysisStatusType,
  description: z.string().nullable(),
  extractedText: z.string().nullable()
});
const assetFileType = z.object({
  variant: assetVariantType,
  format: assetFileFormatType,
  byteSize: z.number(),
  width: z.number(),
  height: z.number(),
  url: z.url(),
  expiresAt: z.iso.datetime()
});
const assetDetailsType = z.object({
  assetID: publicID("ast"),
  filename: z.string(),
  status: assetStatusType,
  failureReason: z.string().nullable(),
  analysis: assetAnalysisType.nullable(),
  files: z.array(assetFileType)
});
const assetUploadRegistrationType = z.object({
  assetID: publicID("ast"),
  expiresAt: z.iso.datetime()
});

export {
  assetStatusType,
  assetAnalysisStatusType,
  assetFileFormatType,
  assetVariantType,
  assetHeadersType,
  assetSearchResultType,
  assetAnalysisType,
  assetFileType,
  assetDetailsType,
  assetUploadRegistrationType
};
