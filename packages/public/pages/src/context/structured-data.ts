import type { BreadcrumbItem, SiteContext } from "./types";

interface StructuredDataOptions {
  site: SiteContext;
  title: string;
  description?: string;
  /** Absolute URL of the page. */
  url: string;
  updatedAt?: string;
  image?: string;
  /** The section, groups, and page, from the top. Items without a URL are left out. */
  trail: BreadcrumbItem[];
}

/** Makes JSON safe inside a `<script>` element, where `</script>` would end it. */
const serialize = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c");
/**
 * Creates schema.org JSON-LD for a page: the site with its search action, the page as a
 * technical article, and its breadcrumbs.
 */
const createStructuredData = (options: StructuredDataOptions): string => {
  const { site } = options;
  const websiteID = `${site.url}#website`;
  const breadcrumbs = options.trail.filter((item) => item.href);

  return serialize({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteID,
        "name": site.name,
        "description": site.description,
        "url": site.url,
        "inLanguage": site.language,
        "potentialAction": site.search && {
          "@type": "SearchAction",
          "target": { "@type": "EntryPoint", "urlTemplate": `${site.url}?q={search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "TechArticle",
        "headline": options.title,
        "description": options.description,
        "url": options.url,
        "dateModified": options.updatedAt,
        "image": options.image,
        "inLanguage": site.language,
        "isPartOf": { "@id": websiteID }
      },
      ...(breadcrumbs.length > 1
        ? [
            {
              "@type": "BreadcrumbList",
              "itemListElement": breadcrumbs.map((item, index) => {
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "name": item.label,
                  "item": new URL(item.href!, site.url).href
                };
              })
            }
          ]
        : [])
    ]
  });
};

export { createStructuredData };
