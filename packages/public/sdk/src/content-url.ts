import { toContentSlug } from "./content-slug";

/** A decoded canonical path, optionally with a decoded heading anchor. */
interface ContentLocation {
  path: string;
  /** Authoritative derived path returned by the API, including ID fallbacks. */
  slugPath?: string;
  anchor?: string;
}
interface ContentURLOptions {
  /** Use derived slugs (default), or percent-encoded original names. */
  format?: "slug" | "name";
  /** Decoded collection prefix to remove, matched on whole segments. Defaults to "/". */
  rootPath?: string;
  /**
   * Destination root: a root-relative URL such as "/docs", or an absolute HTTP(S) URL.
   * Its pathname is retained as a prefix. Queries, fragments, and credentials are not allowed.
   * Defaults to "/". Supply this as a URL; its pathname may already be percent-encoded.
   */
  baseURL?: string;
}

/**
 * Convert a canonical Andesine path or search/citation location to a website URL.
 *
 * Uses the API slugPath when supplied, or derives slugs from decoded names.
 * Set format to "name" to preserve names. Heading anchors are encoded without slug conversion.
 * This is a pure function: it does not resolve IDs, fetch content, or pin a snapshot.
 * @param source - An absolute decoded path, or an API location with path, slugPath, and optional anchor.
 * Collection-ID-relative selectors must first be resolved through the API to a canonical path.
 * @param options - Source collection root and destination URL prefix.
 * @returns A root-relative URL by default, or an absolute URL when baseURL is absolute.
 * The source root itself maps to the destination root without adding a trailing slash.
 * @throws TypeError for invalid paths, a source outside rootPath, an invalid baseURL,
 * or a symbol-only name without an API slugPath. Pass the API object for ID fallbacks.
 * @example
 * toContentURL({ path: "/Docs/Getting started", anchor: "install" }, {
 *   rootPath: "/Docs", baseURL: "/docs"
 * }); // "/docs/getting-started#install"
 */
const toContentURL = (
  source: string | ContentLocation,
  options: ContentURLOptions = {}
): string => {
  const location = typeof source === "string" ? { path: source } : source;
  const segments = contentPathSegments(location.path);
  const useSlugs = options.format !== "name";
  const outputSegments = useSlugs
    ? location.slugPath
      ? contentPathSegments(location.slugPath)
      : segments.map((segment) => toContentSlug(segment))
    : segments;
  const root = contentPathSegments(options.rootPath ?? "/");
  const outsideRoot = root.some(
    (segment, index) =>
      segments[index] !== segment && (!useSlugs || outputSegments[index] !== toContentSlug(segment))
  );

  const baseURL = options.baseURL ?? "/";
  const relative = baseURL.startsWith("/") && !baseURL.startsWith("//");
  const url = new URL(baseURL, relative ? "https://andesine.invalid" : undefined);
  const invalidBase =
    !["http:", "https:"].includes(url.protocol) ||
    Boolean(url.search || url.hash || url.username || url.password) ||
    baseURL.includes("\\");

  if (outputSegments.length !== segments.length)
    throw new TypeError("path and slugPath must have the same number of segments");
  if (outsideRoot) throw new TypeError("Content path is outside rootPath");
  if (invalidBase) {
    throw new TypeError(
      "baseURL must be a root-relative or HTTP(S) URL without credentials, query, or fragment"
    );
  }

  const suffix = outputSegments.slice(root.length).map(encodeURIComponent).join("/");
  const prefix = url.pathname.replace(/\/+$/, "");

  url.pathname = (suffix ? `${prefix}/${suffix}` : prefix) || "/";
  url.hash = location.anchor ? encodeURIComponent(location.anchor) : "";

  return relative ? `${url.pathname}${url.hash}` : url.href;
};

const contentPathSegments = (path: string): string[] => {
  const segments = path === "/" ? [] : path.slice(1).split("/");
  const invalid =
    !path.startsWith("/") ||
    segments.some((segment) => !segment || segment === "." || segment === "..");

  if (invalid) {
    throw new TypeError("Use an absolute decoded content path without empty or dot segments");
  }

  return segments;
};

export { toContentURL };
export type { ContentLocation, ContentURLOptions };
