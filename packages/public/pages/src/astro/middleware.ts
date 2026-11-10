import { defineMiddleware } from "astro:middleware";

/** The highest quality of the given media types in an `Accept` header. */
const getQuality = (accept: string, types: string[]): number => {
  return Math.max(
    0,
    ...accept.split(",").flatMap((range) => {
      const [type = "", ...parameters] = range.split(";").map((part) => part.trim());
      const quality = parameters.find((parameter) => parameter.startsWith("q="));

      return types.includes(type.toLowerCase())
        ? [quality ? Number(quality.slice(2)) || 0 : 1]
        : [];
    })
  );
};
/** Agents ask for Markdown with `text/markdown`, or with `text/plain` instead of HTML. */
const prefersMarkdown = (accept: string): boolean => {
  const markdown = getQuality(accept, ["text/markdown", "text/x-markdown", "text/plain"]);

  return markdown > 0 && markdown > getQuality(accept, ["text/html", "application/xhtml+xml"]);
};
const withVary = (response: Response): Response => {
  const result = new Response(response.body, response);

  result.headers.append("Vary", "Accept");

  return result;
};

/**
 * Serves a page's Markdown to requests that prefer it. Hosts serve built pages as files, so this
 * works in development only; a host can add the same rule for `Accept: text/markdown`.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  // Page URLs have no file extension; they can end with or without a slash.
  const isPage = !/\.[^/]+$/.test(pathname);

  if (context.isPrerendered || !isPage) return next();

  const accept = context.request.headers.get("accept") ?? "";

  return withVary(
    prefersMarkdown(accept)
      ? await context.rewrite(`${pathname.replace(/\/?$/, "/")}index.md`)
      : await next()
  );
});
