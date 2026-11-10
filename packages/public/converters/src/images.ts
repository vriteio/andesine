import type { Awaitable, ContentNode } from "./types";
import { ConversionError } from "./utils";

interface ImageAsset {
  assetID: string;
  variant: string;
  url: string;
}
interface ImageURLOptions {
  /** Variant to resolve, or an async selector for each image. Defaults to "display". */
  variant?: string | ((node: ContentNode) => Awaitable<string>);
}
interface PublishedImageContent {
  assets: readonly ImageAsset[];
}

/**
 * Create an async imageURL callback from published asset references.
 * @param assets - Assets from the same entry and snapshot as the document being converted.
 * @param options - Image variant or async variant selector. Defaults to "display".
 * @returns A callback that looks up node.attrs.assetID and returns the supplied URL unchanged.
 * It does not fetch images, refresh expiring URLs, or fall back to another variant.
 * @throws ConversionError when the callback cannot find the requested asset and variant.
 */
const createImageURLResolver = (assets: readonly ImageAsset[], options: ImageURLOptions = {}) => {
  const urls = new Map<string, Map<string, string>>();

  for (const asset of assets) {
    const variants = urls.get(asset.assetID) || new Map<string, string>();
    variants.set(asset.variant, asset.url);
    urls.set(asset.assetID, variants);
  }

  return async (node: ContentNode): Promise<string> => {
    const assetID = node.attrs?.assetID;
    const variant =
      typeof options.variant === "function"
        ? await options.variant(node)
        : (options.variant ?? "display");
    const url = typeof assetID === "string" ? urls.get(assetID)?.get(variant) : undefined;

    if (!url) {
      throw new ConversionError(`Image asset ${String(assetID)} has no URL for variant ${variant}`);
    }

    return url;
  };
};
/**
 * Supply converter options derived from a published-content response or full list item.
 * @param page - An object with the document's published asset references; no SDK type is required.
 * @param options - Image variant settings passed to createImageURLResolver().
 * @returns An imageURL callback only. Title, fragment, and property defaults remain unchanged.
 * Missing asset URLs throw ConversionError when an image is converted, not during this call.
 * @example
 * const html = await toHTML(page.content, { ...publishedContentOptions(page), title: "omit" });
 */
const publishedContentOptions = (page: PublishedImageContent, options?: ImageURLOptions) => ({
  imageURL: createImageURLResolver(page.assets, options)
});

export { createImageURLResolver, publishedContentOptions };
export type { ImageAsset, ImageURLOptions, PublishedImageContent };
