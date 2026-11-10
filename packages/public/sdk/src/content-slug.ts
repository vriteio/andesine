/**
 * Derive a URL segment from a content name. Unicode letters, marks, and numbers are retained.
 * Other characters become hyphens. Case and compatibility forms are normalized.
 * @param name - Decoded entry or collection name.
 * @param id - Public content ID, required when the name contains no letters or numbers.
 * @returns A decoded slug. Encode it once when placing it in a URL.
 * @throws TypeError when a symbol-only name has no valid public ID fallback.
 */
const toContentSlug = (name: string, id?: string): string => {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .normalize("NFC");

  if (/[\p{L}\p{N}]/u.test(slug)) return slug;
  if (id && /^(?:ent|coll)_[A-Za-z\d]{1,22}$/.test(id))
    return id.toLowerCase().replaceAll("_", "-");

  throw new TypeError("Use the API slugPath for a name without letters or numbers");
};

export { toContentSlug };
