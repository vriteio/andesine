import type { APIRoute } from "astro";
import config, { highlight } from "virtual:andesine/config";
import social from "virtual:andesine/social";
import { unavailableResponse } from "../../output/response";
import { toSocialData } from "../../site";
import { getLiveRoute } from "../../site/live";
import { renderSocialImage } from "../../social/render";

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const pageURL = new URL(url);

  pageURL.pathname = url.pathname.replace(/social\.png$/, "");

  try {
    const route = await getLiveRoute(config, highlight, pageURL, request.signal);

    if (route.type !== "page") return new Response(null, { status: 404 });

    const image = await renderSocialImage(social.card!, {
      ...toSocialData(route.context),
      logo: social.logo,
      showSiteName: !config.logo || config.logo.title,
      logoFormat: config.logo?.format,
      background: social.background,
      brand: config.brand
    });

    return new Response(image, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" }
    });
  } catch (error) {
    return unavailableResponse(error);
  }
};
