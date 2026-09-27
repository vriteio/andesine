/* eslint-disable @typescript-eslint/consistent-type-imports -- ambient modules cannot use import statements */
declare module "virtual:andesine/config" {
  const config: import("./config").PagesConfig;

  /** Shiki options from the Astro Markdown config, for Andesine code blocks. */
  export const highlight: import("./content/prepare").HighlightOptions;
  /** The text of your own skill file, when `agents.skill` is set. */
  export const skill: string | undefined;
  export default config;
}

declare module "virtual:andesine/social" {
  const social: {
    /** Undefined when the template has no social card. */
    card?: import("./social/types").SocialCard;
    /** Data URLs of the configured images. */
    logo?: string;
    background?: string;
  };

  export default social;
}
