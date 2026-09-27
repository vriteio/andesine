import type { Font } from "satori";
import type { Markup } from "./html";

interface SocialCardData {
  siteName: string;
  /** Shows the site name after the logo, like the page header; always without a logo. */
  showSiteName: boolean;
  /** The format of the configured logo. */
  logoFormat?: "icon" | "full";
  title: string;
  description?: string;
  /** Label of the page's group. */
  group?: string;
  /** Data URL of the configured logo. */
  logo?: string;
  /** Data URL of the configured card background. */
  background?: string;
  brand: { primary: string; secondary: string; tertiary: string };
}

interface SocialCardFont extends Omit<Font, "data"> {
  /** The font file, or a data URL of it, e.g. from a Vite `?inline` import. */
  data: Font["data"] | string;
}

/** The template's social card: the design of generated page images. */
interface SocialCard {
  /** Fonts for the card text. Satori reads TTF, OTF, and WOFF files, but not WOFF2. */
  fonts(): SocialCardFont[] | Promise<SocialCardFont[]>;
  /**
   * Returns the card as HTML, 1200 by 630 pixels, e.g. from the `html` tag. Satori supports a
   * subset of CSS, and Tailwind classes in `tw` attributes.
   */
  render(data: SocialCardData): Markup | string;
}

export type { SocialCardData, SocialCardFont, SocialCard };
