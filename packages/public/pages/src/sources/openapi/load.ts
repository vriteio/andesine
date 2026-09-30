import type { OpenAPISourceConfig } from "../../config";
import { toHref, toSegments } from "../../routing";
import type { OpenAPIContent, SourceData, SourceNode, SourcePage } from "../types";
import { toOperationTitle } from "./labels";
import { toOpenAPIMarkdown, type OpenAPILinks } from "./markdown";
import type { ApiModel, ApiOperation } from "./model";

interface LoadOptions {
  base: string;
  /** The site URL, for absolute links in Markdown alternatives. */
  site: string;
}

/** Makes a URL segment, e.g. `schemaVersions.list` becomes `schema-versions-list`. */
const toSlug = (value: string): string => {
  return value
    .replace(/(\p{Ll}|\d)(\p{Lu})/gu, "$1-$2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
};
const createLinks = (source: OpenAPISourceConfig, model: ApiModel, base: string) => {
  const prefix = [
    ...toSegments(base, "Site base"),
    ...toSegments(source.mount, `Source "${source.id}" mount`)
  ];
  const href = toHref(prefix);
  const used = new Set([href]);
  /** Adds a number to a slug while its URL is in use, e.g. `list-2`. */
  const toUniqueSlug = (parents: string[], slug: string): string => {
    let result = slug;

    for (let index = 2; used.has(toHref(prefix, [...parents, result])); index++) {
      result = `${slug}-${index}`;
    }

    used.add(toHref(prefix, [...parents, result]));

    return result;
  };
  const tagSlugs = new Map(
    model.tags.map((tag) => [tag.name, toUniqueSlug([], toSlug(tag.name) || "tag")])
  );
  const links: OpenAPILinks = {
    operations: Object.fromEntries(
      model.operations.map((operation) => {
        const tag = operation.tags[0] && tagSlugs.get(operation.tags[0]);
        const slug = toSlug(operation.id) || toSlug(`${operation.method} ${operation.path}`);
        // `entries.get` in the `entries` tag becomes `entries/get/`.
        const parents = tag ? [tag] : [];
        const name = tag && slug.startsWith(`${tag}-`) ? slug.slice(tag.length + 1) : slug;

        return [operation.id, toHref(prefix, [...parents, toUniqueSlug(parents, name)])];
      })
    ),
    tags: Object.fromEntries([...tagSlugs].map(([name, slug]) => [name, toHref(prefix, [slug])]))
  };

  return { href, links };
};
/**
 * Maps an API model to pages and navigation: an overview page from the API description,
 * servers, and authentication schemes, tags as groups with their descriptions as landing
 * pages, and one page for each operation.
 */
const createOpenAPISource = (
  source: OpenAPISourceConfig,
  model: ApiModel,
  options: LoadOptions
): SourceData => {
  const { href, links } = createLinks(source, model, options.base);
  const toPage = (
    id: string,
    pageHref: string,
    title: string,
    parts: Pick<OpenAPIContent, "operation" | "tag">
  ): SourcePage => {
    const pageURL = new URL(pageHref, options.site);
    const content: OpenAPIContent = { type: "openapi", model, links, ...parts };

    return {
      sourceID: source.id,
      id,
      href: pageHref,
      title,
      toc: true,
      // Operation pages show their examples next to the fields, in place of the ToC.
      layout: parts.operation ? "reference" : "docs",
      searchHidden: false,
      markdown: toOpenAPIMarkdown(content, (url) => new URL(url, pageURL).href),
      content
    };
  };
  const hasOverview = Boolean(
    model.description || model.servers.length || model.securitySchemes.length
  );
  const overview = hasOverview ? toPage("overview", href, model.title, {}) : undefined;
  const operationPages = new Map(
    model.operations.map((operation) => {
      const page = toPage(
        `operation:${operation.id}`,
        links.operations[operation.id]!,
        toOperationTitle(operation),
        { operation }
      );

      return [operation.id, page];
    })
  );
  const toLeaf = (operation: ApiOperation): SourceNode => {
    const page = operationPages.get(operation.id)!;

    return { id: `${source.id}:${page.id}`, label: page.title, page, method: operation.method };
  };
  const groups = model.tags.map((tag): SourceNode => {
    const page =
      source.tagPages && tag.description
        ? toPage(`tag:${tag.name}`, links.tags[tag.name]!, tag.label, { tag })
        : undefined;

    return {
      id: `${source.id}:tag:${tag.name}`,
      label: tag.label,
      page,
      children: model.operations.filter((operation) => operation.tags[0] === tag.name).map(toLeaf)
    };
  });
  const untagged = model.operations.filter((operation) => !operation.tags.length).map(toLeaf);
  const navigation = [
    ...(overview ? [{ id: `${source.id}:overview`, label: "Overview", page: overview }] : []),
    ...groups,
    ...untagged
  ];
  const pages = [
    ...(overview ? [overview] : []),
    ...groups.flatMap((group) => (group.page ? [group.page] : [])),
    ...operationPages.values()
  ];

  return { id: source.id, href, pages, navigation };
};

export { createLinks, createOpenAPISource };
