/** Splits a decoded path, such as `/guides/intro/` or `guides/intro`, into segments. */
const toSegments = (path: string, label: string): string[] => {
  const segments = path.split("/").filter(Boolean);
  const invalid = segments.some((segment) => /^\.\.?$|[\\?#%]/.test(segment));

  if (invalid) {
    throw new Error(`${label}: "${path}" is not a valid path. Do not use ., .., \\, ?, #, or %.`);
  }

  return segments;
};
/** Joins decoded segments into an encoded URL path with a trailing slash. */
const toHref = (...segments: string[][]): string => {
  const parts = segments.flat().map(encodeURIComponent);

  return parts.length ? `/${parts.join("/")}/` : "/";
};

export { toSegments, toHref };
