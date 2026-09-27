import type { APIRoute } from "astro";
import config, { highlight } from "virtual:andesine/config";
import { createMarkdownNotFound } from "../../output/not-found";
import { textResponse, unavailableResponse } from "../../output/response";
import { getLiveRoute } from "../../site/live";

export const prerender = false;

export const GET: APIRoute = async ({ url, request, redirect }) => {
  const pageURL = new URL(url);

  // Both `/guide/index.md` and `/guide.md` belong to the page at `/guide/`.
  pageURL.pathname = url.pathname.replace(/(?:\/index)?\.md$/, "/");

  try {
    const route = await getLiveRoute(config, highlight, pageURL, request.signal);

    if (route.type === "redirect") return redirect(`${route.target}index.md`);

    if (route.type === "not-found") {
      return textResponse(createMarkdownNotFound(config, url, route.pages ?? []), "text/markdown", {
        status: 404,
        headers: { "Cache-Control": "no-store" }
      });
    }

    return textResponse(route.markdown, "text/markdown", {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return unavailableResponse(error);
  }
};
