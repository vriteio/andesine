import { ASSET_DISPLAY_SIZE, ASSET_THUMBNAIL_SIZE } from "@andesine/backend/lib/assets/storage";
import type { AssetConfig } from "@andesine/backend/lib/assets/config-schema";
import sharp from "sharp";

interface ProcessedImageFile {
  variant: "thumbnail" | "display";
  format: "jpeg" | "png" | "webp";
  body: Buffer;
  width: number;
  height: number;
}

class InvalidImageError extends Error {}

const JPEG_SIGNATURE = Buffer.from("ffd8ff", "hex");
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");
// The RIFF format identifier follows its four-byte signature and four-byte size field.
const RIFF_FORMAT_OFFSET = 8;
const PNG_CHUNK_LENGTH_BYTES = 4;
const PNG_CHUNK_HEADER_BYTES = 8;
// Each PNG chunk has a four-byte length, four-byte type, and four-byte checksum.
const PNG_CHUNK_OVERHEAD_BYTES = 12;
const PNG_ANIMATION_CONTROL_CHUNK = "acTL";

const getImageFormat = (body: Buffer): ProcessedImageFile["format"] => {
  if (body.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return "jpeg";

  const isWebP =
    body.subarray(0, RIFF_SIGNATURE.length).equals(RIFF_SIGNATURE) &&
    body
      .subarray(RIFF_FORMAT_OFFSET, RIFF_FORMAT_OFFSET + WEBP_SIGNATURE.length)
      .equals(WEBP_SIGNATURE);
  if (isWebP) return "webp";

  if (body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    let offset = PNG_SIGNATURE.length;
    // libvips may decode APNG as a still PNG, so reject its animation chunk explicitly.
    while (offset + PNG_CHUNK_OVERHEAD_BYTES <= body.length) {
      const length = body.readUInt32BE(offset);
      const name = body
        .subarray(offset + PNG_CHUNK_LENGTH_BYTES, offset + PNG_CHUNK_HEADER_BYTES)
        .toString("ascii");
      if (name === PNG_ANIMATION_CONTROL_CHUNK) {
        throw new InvalidImageError("Animated images are not supported");
      }

      if (length > body.length - offset - PNG_CHUNK_OVERHEAD_BYTES) {
        throw new InvalidImageError("The PNG file is incomplete");
      }
      offset += length + PNG_CHUNK_OVERHEAD_BYTES;
    }
    return "png";
  }

  throw new InvalidImageError("Use a JPEG, PNG, or static WebP image");
};
const processImage = async (
  body: Buffer,
  config: AssetConfig,
  maximumOutputBytes: number,
  displaySize = ASSET_DISPLAY_SIZE
): Promise<ProcessedImageFile[]> => {
  const format = getImageFormat(body);
  const options = { limitInputPixels: config.ASSET_MAX_INPUT_PIXELS, failOn: "warning" as const };
  const files: ProcessedImageFile[] = [];
  let outputBytes = 0;

  try {
    const metadata = await sharp(body, options).metadata();

    if (
      metadata.format !== format ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > config.ASSET_MAX_INPUT_PIXELS
    ) {
      throw new InvalidImageError("Image dimensions or format are not supported");
    }
    if ((metadata.pages || 1) > 1 || metadata.loop !== undefined || metadata.delay?.length) {
      throw new InvalidImageError("Animated images are not supported");
    }

    for (const variant of ["display", "thumbnail"] as const) {
      // A small display file also serves as its thumbnail; store and count it only once.
      if (
        variant === "thumbnail" &&
        files[0].width <= ASSET_THUMBNAIL_SIZE &&
        files[0].height <= ASSET_THUMBNAIL_SIZE
      )
        continue;
      const size = variant === "thumbnail" ? ASSET_THUMBNAIL_SIZE : displaySize;
      const pipeline = sharp(body, options)
        .autoOrient()
        .toColourspace("srgb")
        .timeout({ seconds: 20 });

      pipeline.resize({ width: size, height: size, fit: "inside", withoutEnlargement: true });

      // Sharp strips all metadata, including EXIF and GPS, by default. Never retain metadata here.
      const result = await pipeline.webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
      outputBytes += result.data.length;

      if (outputBytes > maximumOutputBytes) {
        throw new InvalidImageError("Processed image exceeds its storage reservation");
      }

      files.push({
        variant,
        format: "webp",
        body: result.data,
        width: result.info.width,
        height: result.info.height
      });
    }
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError("The image could not be decoded within the processing limits");
  }

  return files;
};

export { InvalidImageError, processImage };
export type { ProcessedImageFile };
