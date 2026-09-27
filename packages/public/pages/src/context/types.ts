import type { AIService, IconLinkConfig, LinkConfig } from "../config";

interface SiteLogo {
  src: string;
  /** A square mark next to the site name, or a full wordmark before it. */
  format: "icon" | "full";
  /** The text in a full logo, for screen readers. */
  alt?: string;
  /** Shows the site name after the logo. */
  title: boolean;
}

interface SearchSourceContext {
  id: string;
  /** Group label in results: the section label, or the site name. */
  label: string;
  /** Pagefind for local pages, or the Andesine search endpoint. */
  type: "pagefind" | "andesine";
}

interface AnswersContext {
  endpoint: string;
  /** ID of the source that answers questions. */
  source: string;
}

interface SearchContext {
  sources: SearchSourceContext[];
  endpoint: string;
  /** Base-prefixed URL of the Pagefind directory. */
  pagefind: string;
  /** Undefined when no Andesine source has AI answers. */
  answers?: AnswersContext;
}

interface SiteContext {
  name: string;
  description?: string;
  language: string;
  /** Base-prefixed URL of the home page. */
  href: string;
  /** Absolute URL of the home page. */
  url: string;
  /** A prefix for browser storage keys, unique for each site. */
  storageKey: string;
  logo?: SiteLogo;
  favicon?: string;
  /** Where sections show: tabs in the header, or links at the top of the navigation. */
  sectionsDisplay: "tabs" | "navigation";
  links: IconLinkConfig[];
  cta?: LinkConfig;
  socialLinks: IconLinkConfig[];
  /** Undefined when no source is searchable. */
  search?: SearchContext;
}

interface SectionContext {
  id: string;
  label: string;
  icon?: string;
  href: string;
  current: boolean;
}

interface NavigationItem {
  id: string;
  label: string;
  /** Groups without a landing page have no URL. */
  href?: string;
  current: boolean;
  /** The item contains the current page. */
  active: boolean;
  children: NavigationItem[];
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeadingContext {
  id: string;
  text: string;
  depth: number;
}

interface PageLink {
  label: string;
  href: string;
}

interface PageMeta {
  /** The document title: the page title, then the site name. */
  title: string;
  /** The page description, or else the site description. */
  description?: string;
  /** The Open Graph type: `website` for the home page, `article` for other pages. */
  type: "website" | "article";
}

interface PageFragments {
  /** The page has a `summary` slot with content. */
  summary: boolean;
  /** The page has an `aside` slot with content. */
  aside: boolean;
}

interface SocialImage {
  /** Absolute URL of the image. */
  url: string;
  /** Known for generated images. */
  width?: number;
  height?: number;
}

interface OpenInLink {
  id: AIService;
  label: string;
  /** Opens the service with the page's Markdown alternative as context. */
  href: string;
}

interface PageActionsContext {
  openIn: OpenInLink[];
}

interface PageContext {
  site: SiteContext;
  title: string;
  description?: string;
  meta: PageMeta;
  fragments: PageFragments;
  layout: "docs" | "wide";
  sections: SectionContext[];
  navigation: NavigationItem[];
  /** The groups that contain the page, from the section root. */
  breadcrumbs: BreadcrumbItem[];
  headings: HeadingContext[];
  previous?: PageLink;
  next?: PageLink;
  /** Absolute URL of the page; undefined for the not-found page. */
  canonical?: string;
  /** URL of the page's Markdown alternative; undefined for the not-found page. */
  markdown?: string;
  /** Undefined when page actions are off, or for the not-found page. */
  actions?: PageActionsContext;
  /** ISO date of the last content change, when known. */
  updatedAt?: string;
  /** Search engines must not index the page: it is hidden from search, or not found. */
  noindex?: boolean;
  /** schema.org JSON-LD, safe to put in a `<script type="application/ld+json">`. */
  structuredData?: string;
  /** The image for link previews: generated for the page, or the configured default. */
  image?: SocialImage;
}

export type {
  SearchSourceContext,
  AnswersContext,
  SearchContext,
  SiteLogo,
  SiteContext,
  SectionContext,
  NavigationItem,
  BreadcrumbItem,
  HeadingContext,
  PageLink,
  PageMeta,
  PageFragments,
  SocialImage,
  OpenInLink,
  PageActionsContext,
  PageContext
};
