import type { PagesConfig } from "../config";
import { socialImageSize } from "../social/size";
import type { SocialImage } from "./types";

/** The link preview image of a page: its generated card, or the configured default image. */
const getSocialImage = (config: PagesConfig, href?: string): SocialImage | undefined => {
  const site = new URL(config.base, config.site);

  if (href && config.social.generate) {
    return { url: new URL(`${href}social.png`, site).href, ...socialImageSize };
  }

  return config.social.image ? { url: new URL(config.social.image, site).href } : undefined;
};

export { getSocialImage };
