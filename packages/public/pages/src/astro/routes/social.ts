import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import social from "virtual:andesine/social";
import { getSocialPaths, type SocialPath } from "../../site";
import { renderSocialImage } from "../../social/render";

export const getStaticPaths = () => getSocialPaths(config);

export const GET: APIRoute = async ({ props }) => {
  const image = await renderSocialImage(social.card!, {
    ...(props as SocialPath["props"]).data,
    logo: social.logo,
    showSiteName: !config.logo || config.logo.title,
    logoFormat: config.logo?.format,
    background: social.background,
    brand: config.brand
  });

  return new Response(image, { headers: { "Content-Type": "image/png" } });
};
