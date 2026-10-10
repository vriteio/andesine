/**
 * Matches an `https:` URL against declared request URLs with CSP source rules: an origin
 * matches every path, a path ending in `/` matches as a prefix, and other paths match exactly.
 */
const isDeclaredURL = (value: string, sources: string[]): boolean => {
  if (!URL.canParse(value)) return false;

  const url = new URL(value);

  if (url.protocol !== "https:" || url.username || url.password) return false;

  return sources.some((value) => {
    if (!URL.canParse(value)) return false;

    const source = new URL(value);

    if (source.origin !== url.origin) return false;

    if (source.pathname === "/") return true;

    return source.pathname.endsWith("/")
      ? url.pathname.startsWith(source.pathname)
      : url.pathname === source.pathname;
  });
};

export { isDeclaredURL };
