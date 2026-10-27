import { createMemo } from "solid-js";

interface LinkInputEntry {
  id: string;
  title: string;
  /** Where the entry is, e.g. its collections' names. */
  path: string;
}
interface LinkOption {
  value: string;
  label: string;
  icon: string;
  /** The section the option is listed in, e.g. "Entries". */
  group: string;
}
interface LinkOptionsSource {
  /** The link: an `entry:<entryID>` link, a URL, or empty. */
  value: string;
  entries: LinkInputEntry[];
  /** The link for typed text, e.g. a valid URL, or null when it isn't one. */
  toHref(text: string): string | null;
}

const ENTRY_LINK_PREFIX = "entry:";
const MAX_OPTIONS = 20;

/** The entry ID of an `entry:` link, without its anchor. */
const getLinkedEntryID = (href: string): string | null => {
  if (!href.startsWith(ENTRY_LINK_PREFIX)) return null;

  return href.slice(ENTRY_LINK_PREFIX.length).split("#")[0] || null;
};
const toEntryOption = (entry: LinkInputEntry): LinkOption => {
  return {
    value: `${ENTRY_LINK_PREFIX}${entry.id}`,
    label: entry.title,
    icon: "i-lucide:file-text",
    group: "Entries"
  };
};
const toURLOption = (href: string, label: string): LinkOption => {
  return { value: href, label, icon: "i-lucide:globe", group: "Link" };
};

/**
 * A link field's logic, without its look: typed text searches the entries by title and path, or
 * makes a link; an entry link shows the entry's title.
 */
const createLinkOptions = (source: LinkOptionsSource) => {
  // Made once for the entries, not on each typed key.
  const searchTexts = createMemo(() => {
    return source.entries.map((entry) => `${entry.title} ${entry.path}`.toLocaleLowerCase());
  });
  /** The value's option, e.g. with the entry's title, or null when empty. */
  const selected = (): LinkOption | null => {
    const entryID = getLinkedEntryID(source.value);
    const entry = entryID && source.entries.find(({ id }) => id === entryID);

    if (!source.value) return null;

    return entry ? toEntryOption(entry) : toURLOption(source.value, source.value);
  };
  /** The options for typed text: its link, if it makes one, then the matching entries. */
  const search = (query: string): LinkOption[] => {
    const text = query.trim();
    const lowerText = text.toLocaleLowerCase();
    const href = text ? source.toHref(text) : null;
    const entries: LinkOption[] = [];
    const isURL = href && !href.startsWith(ENTRY_LINK_PREFIX);

    for (const [index, entry] of source.entries.entries()) {
      if (entries.length === MAX_OPTIONS) break;
      if (!lowerText || searchTexts()[index].includes(lowerText))
        entries.push(toEntryOption(entry));
    }

    return isURL ? [toURLOption(href, text), ...entries] : entries;
  };
  /** The link for typed text, `""` for empty text, or null when it isn't a link. */
  const resolve = (text: string): string | null => {
    const trimmed = text.trim();

    return trimmed ? source.toHref(trimmed) : "";
  };

  return { selected, search, resolve };
};

export { createLinkOptions, getLinkedEntryID };
export type { LinkInputEntry, LinkOptionsSource };
