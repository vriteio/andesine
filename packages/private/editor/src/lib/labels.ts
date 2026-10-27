/** A label with its first letter in upper case, e.g. `Note` for `note`. */
const capitalize = (label: string): string => label.charAt(0).toUpperCase() + label.slice(1);
/** An element category, the same across extensions: trimmed, single-spaced, and lower case. */
const normalizeCategory = (category?: string): string | undefined => {
  return category?.trim().replace(/\s+/g, " ").toLowerCase() || undefined;
};

export { capitalize, normalizeCategory };
