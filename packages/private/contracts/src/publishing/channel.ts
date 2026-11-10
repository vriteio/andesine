import { normalizeResourceName } from "@andesine/document";
import * as z from "zod";

const publishingChannelCodeType = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .transform((code) => normalizeResourceName(code, "channel"))
  .pipe(z.string());
const publishingChannelNameType = z.string().trim().min(1).max(50);
export { publishingChannelCodeType, publishingChannelNameType };
