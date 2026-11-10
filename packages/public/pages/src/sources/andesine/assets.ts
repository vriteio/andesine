import type { PublishedAsset } from "@andesine/sdk";
import { toHref, toSegments } from "../../routing";

interface AssetStore {
  /** Returns the URL that pages use for an image. */
  resolve(asset: PublishedAsset, entryID: string): Promise<string>;
}

const assetPath = "_andesine/assets";
const assetFile = /^[a-f\d]{64}\.(png|jpeg|webp)$/;
const mimeTypes = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

const getAssetPrefix = (base: string): string => {
  return toHref(toSegments(base, "Site base"), assetPath.split("/"));
};
const getDeliveryURL = (asset: PublishedAsset, entryID: string): string => {
  const url = new URL(asset.url);
  const isPublicHTTPS = url.protocol === "https:" && !url.username && !url.password;

  if (!isPublicHTTPS) {
    throw new Error(`Entry ${entryID}, asset ${asset.assetID}: expected a public HTTPS URL.`);
  }

  return url.href;
};
export { assetPath, assetFile, mimeTypes, getAssetPrefix, getDeliveryURL };
export type { AssetStore };
