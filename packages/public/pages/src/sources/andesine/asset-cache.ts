import { mkdir, writeFile } from "node:fs/promises";
import type { PublishedAsset } from "@andesine/sdk";
import { toSHA256 } from "../../hash";
import { type AssetStore, getAssetPrefix, getDeliveryURL, mimeTypes } from "./assets";

interface AssetCache extends AssetStore {
  /** Lists the stored files, for the build output. */
  finish(): Promise<void>;
}

/**
 * Downloads images into a cache directory with content-hash names. The build copies them to
 * the output, so pages do not depend on expiring delivery URLs.
 */
const createAssetCache = (directory: URL, base: string): AssetCache => {
  const prefix = getAssetPrefix(base);
  const files = new Set<string>();
  const downloads = new Map<string, Promise<string>>();
  const download = async (asset: PublishedAsset, entryID: string): Promise<string> => {
    const label = `Entry ${entryID}, asset ${asset.assetID}`;
    const response = await fetch(getDeliveryURL(asset, entryID), {
      credentials: "omit",
      signal: AbortSignal.timeout(30_000)
    });
    const type = response.headers.get("content-type")?.split(";")[0];

    if (!response.ok) throw new Error(`${label}: download failed (${response.status}).`);
    if (type !== mimeTypes[asset.format]) throw new Error(`${label}: unexpected type ${type}.`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    const file = `${await toSHA256(bytes)}.${asset.format}`;

    await mkdir(directory, { recursive: true });
    await writeFile(new URL(file, directory), bytes);
    files.add(file);

    return `${prefix}${file}`;
  };

  return {
    resolve: (asset, entryID) => {
      const key = `${asset.assetID}:${asset.variant}`;

      if (!downloads.has(key)) downloads.set(key, download(asset, entryID));

      return downloads.get(key)!;
    },
    finish: async () => {
      await mkdir(directory, { recursive: true });
      await writeFile(new URL("files.json", directory), JSON.stringify([...files]));
    }
  };
};

export { createAssetCache };
export type { AssetCache };
