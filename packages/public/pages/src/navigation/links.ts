import type { SourceData } from "../sources";

interface Link {
  href: string;
}

const ENTRY_LINK = /^entry:([^?#]+)(.*)$/s;

/** Whether a link is still an `entry:` link, e.g. after it wasn't resolved to a page. */
const isEntryLink = (href: string): boolean => href.startsWith("entry:");

/**
 * Resolves `entry:<entryID>` links of the configuration, e.g. header links, to the entry's page,
 * with an anchor kept. A link to an entry without a page, e.g. an unpublished one, is left out,
 * as published content does with its links.
 */
const createLinkResolver = (sources: SourceData[]) => {
  const hrefs = new Map(
    sources.flatMap((source) => {
      return source.pages.flatMap((page) => {
        return page.content.type === "andesine" ? [[page.id, page.href] as const] : [];
      });
    })
  );
  const resolve = <L extends Link>(link: L): L | undefined => {
    const [, entryID, suffix = ""] = ENTRY_LINK.exec(link.href) ?? [];
    const href = entryID && hrefs.get(entryID);

    if (!entryID) return link;

    return href ? { ...link, href: `${href}${suffix}` } : undefined;
  };

  return {
    resolve,
    resolveAll: <L extends Link>(links: L[]): L[] => links.flatMap((link) => resolve(link) ?? [])
  };
};

type LinkResolver = ReturnType<typeof createLinkResolver>;

export { createLinkResolver, isEntryLink };
export type { LinkResolver };
