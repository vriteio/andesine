import { type assetDeliveryVariants } from "@andesine/contracts/assets";
import { ASSET_THUMBNAIL_SIZE } from "./storage";

interface AssetFile {
  assetID: string;
  variant: string;
  width: number;
  height: number;
}

type DeliveryVariant = (typeof assetDeliveryVariants)[number];

const getAssetIDs = (files: AssetFile[], variant: string): Set<string> => {
  return new Set(files.filter((file) => file.variant === variant).map((file) => file.assetID));
};

// Database rows represent physical files. Delivery can expose the same file in several roles: a
// small display file is also the thumbnail, and the source of assets without one (WebP uploads).
const getDeliveryFiles = <T extends AssetFile>(
  files: T[]
): Array<Omit<T, "variant"> & { variant: DeliveryVariant }> => {
  const thumbnails = getAssetIDs(files, "thumbnail");
  const sources = getAssetIDs(files, "source");

  return files.flatMap((file) => {
    if (file.variant !== "display") {
      const isDelivered = file.variant === "thumbnail" || file.variant === "source";

      return isDelivered ? [{ ...file, variant: file.variant as DeliveryVariant }] : [];
    }

    const isThumbnail =
      !thumbnails.has(file.assetID) &&
      file.width <= ASSET_THUMBNAIL_SIZE &&
      file.height <= ASSET_THUMBNAIL_SIZE;
    const variants: DeliveryVariant[] = [
      "display",
      ...(isThumbnail ? (["thumbnail"] as const) : []),
      ...(sources.has(file.assetID) ? [] : (["source"] as const))
    ];

    return variants.map((variant) => ({ ...file, variant }));
  });
};

export { getDeliveryFiles };
