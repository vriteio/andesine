import * as z from "zod";

/** Image formats of `ImageInput` and their media types. */
const extensionImageFormats = {
  png: ["image/png"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  svg: ["image/svg+xml"],
  ico: ["image/x-icon", "image/vnd.microsoft.icon"]
} as const;
const MAX_EXTENSION_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = Math.ceil(MAX_EXTENSION_IMAGE_SIZE / 3) * 4;
/** The formats an `ImageInput` accepts. */
const imageFormatType = z.enum(
  Object.keys(extensionImageFormats) as [keyof typeof extensionImageFormats]
);
const imageMediaTypes = Object.values(extensionImageFormats).flat();
const imageDataURLType = z
  .string()
  .max(MAX_IMAGE_DATA_LENGTH + 50)
  .regex(
    /^data:image\/(?:png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[\w+/]+=*$/
  );
/** A file chosen in `ImageInput`; `data` is base64. */
const imageFileType = z.strictObject({
  name: z.string().max(255),
  type: z.enum(imageMediaTypes as [string, ...string[]]),
  size: z.number().int().min(1).max(MAX_EXTENSION_IMAGE_SIZE),
  data: z.base64().max(MAX_IMAGE_DATA_LENGTH)
});

export {
  extensionImageFormats,
  MAX_EXTENSION_IMAGE_SIZE,
  imageDataURLType,
  imageFileType,
  imageFormatType
};
