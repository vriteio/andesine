import { ASSET_THUMBNAIL_SIZE } from "./storage";

interface AssetFile {
  assetID: string;
  variant: string;
  width: number;
  height: number;
}

const assetDeliveryVariants = ["thumbnail", "display"] as const;
// Database rows represent physical files. Delivery can expose the same file in both roles.
const getDeliveryFiles = <T extends AssetFile>(
  files: T[]
): Array<Omit<T, "variant"> & { variant: (typeof assetDeliveryVariants)[number] }> => {
  const thumbnails = new Set(
    files.filter((file) => file.variant === "thumbnail").map((file) => file.assetID)
  );

  return files.flatMap((file) => {
    if (file.variant !== "display" && file.variant !== "thumbnail") return [];
    if (
      file.variant === "display" &&
      !thumbnails.has(file.assetID) &&
      file.width <= ASSET_THUMBNAIL_SIZE &&
      file.height <= ASSET_THUMBNAIL_SIZE
    ) {
      return [
        { ...file, variant: "display" as const },
        { ...file, variant: "thumbnail" as const }
      ];
    }
    return [{ ...file, variant: file.variant }];
  });
};

export { assetDeliveryVariants, getDeliveryFiles };
