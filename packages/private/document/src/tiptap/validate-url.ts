// Internal links point to entries by ID, with an optional anchor.
const ENTRY_LINK = /^entry:ent_[A-Za-z\d]{1,22}(?:#\S*)?$/;

const validateURL = (value: string): string | null => {
  const href = value.trim();

  if (!href) return null;
  if (ENTRY_LINK.test(href)) return href;

  try {
    const url = new URL(href);

    return ["http:", "https:", "mailto:"].includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
};

export { validateURL };
