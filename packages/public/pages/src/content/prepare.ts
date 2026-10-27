import type { ContentNode } from "@andesine/converters";
import { toHTMLAST, type HTMLOptions } from "@andesine/converters/html";
import { fromMarkdown } from "@andesine/converters/markdown";
import type { Element, ElementContent, Root } from "hast";
import { bundledLanguages, codeToHast, type BundledLanguage } from "shiki";
import type { HeadingContext } from "../context";
import { isEntryLink } from "../navigation/links";
import { readElement } from "./elements";
import { getText } from "./hast";
import { createIconCSS } from "./icons";

interface HighlightOptions {
  theme?: unknown;
  themes?: Record<string, unknown>;
  defaultColor?: string | false;
}

interface PrepareOptions {
  imageURL: NonNullable<HTMLOptions["imageURL"]>;
  /** Maps content links, such as `/Docs/Setup`, to site URLs. */
  linkURL(href: string): string;
  highlight: HighlightOptions;
}

interface PreparedContent {
  nodes: Root;
  headings: HeadingContext[];
  /** CSS for icon classes in element props. */
  iconCSS: string;
}

/** Highlights code with the site's Shiki theme, as a `pre` element. */
const highlightCode = async (
  text: string,
  language: string,
  options: HighlightOptions
): Promise<Element> => {
  const lang = language in bundledLanguages ? (language as BundledLanguage) : "text";
  // Astro's default config has an empty `themes` object.
  const hasThemes = Object.keys(options.themes ?? {}).length > 0;
  const root = await codeToHast(text, {
    lang,
    ...(hasThemes
      ? { themes: options.themes, defaultColor: options.defaultColor }
      : { theme: options.theme ?? "github-light" })
  } as Parameters<typeof codeToHast>[1]);
  const highlighted = root.children.find((child): child is Element => child.type === "element")!;

  highlighted.properties.dataLanguage = language;

  return highlighted;
};
/** Highlights a converter code block, keeping its title. */
const highlight = async (pre: Element, options: HighlightOptions): Promise<Element> => {
  const code = pre.children.find((child): child is Element => child.type === "element");
  const highlighted = await highlightCode(
    getText(code ?? pre),
    String(code?.properties.dataLanguage ?? "text"),
    options
  );

  if (pre.properties.dataTitle) highlighted.properties.dataTitle = pre.properties.dataTitle;

  return highlighted;
};

/**
 * Converts an Andesine document into a HTML syntax tree for rendering. Heading IDs follow the
 * Andesine anchor rules, so links from search and answers match.
 */
const prepareContent = async (
  document: ContentNode,
  options: PrepareOptions
): Promise<PreparedContent> => {
  const { tree } = await toHTMLAST(document, {
    title: "omit",
    properties: "omit",
    imageURL: options.imageURL
  });
  const root = tree as Root;
  const headings: HeadingContext[] = [];
  const icons: string[] = [];
  // Children are visited in order, so headings keep their document order.
  const visit = async (node: Root | Element): Promise<void> => {
    const children: ElementContent[] = [];

    for (const child of node.children) children.push(...(await visitChild(child)));

    node.children = children;
  };
  const visitChild = async (child: Root["children"][number]): Promise<ElementContent[]> => {
    if (child.type !== "element") return [child as ElementContent];

    const element = readElement(child);

    // The web page shows only human content; agent content is in the Markdown outputs.
    if (element?.name === "Visibility") {
      if (element.props.for === "agents") return [];

      await visit(child);

      return child.children;
    }

    const depth = /^h([1-6])$/.exec(child.tagName)?.[1];
    const href = child.properties.href;
    const isCard = element?.name === "Card";

    if (child.tagName === "pre") return [await highlight(child, options.highlight)];

    if (depth && typeof child.properties.id === "string") {
      headings.push({ id: child.properties.id, text: getText(child), depth: Number(depth) });
    }

    // Links to entries without a page on the site, e.g. in another collection, become text.
    if (child.tagName === "a" && typeof href === "string") {
      const url = options.linkURL(href);

      if (isEntryLink(url)) delete child.properties.href;
      else child.properties.href = url;
    }

    if (typeof element?.props.icon === "string") icons.push(element.props.icon);

    if (isCard && typeof element.props.href === "string") {
      const { href: cardHref, ...rest } = element.props;
      const url = options.linkURL(cardHref);
      // A card that links to an entry without a page, e.g. an unpublished one, isn't a link.
      const props = isEntryLink(url) ? rest : { ...rest, href: url };

      child.properties.dataAndesineProps = JSON.stringify(props);
    }

    await visit(child);

    return [child];
  };

  await visit(root);

  return { nodes: root, headings, iconCSS: await createIconCSS(icons) };
};

/** Prepares Markdown, such as OpenAPI descriptions, like Andesine content. Images keep their URLs. */
const prepareMarkdown = async (
  markdown: string,
  highlight: HighlightOptions
): Promise<PreparedContent> => {
  const document = await fromMarkdown(markdown, {
    document: "fragment",
    imageAssetID: (image) => image.url,
    // Content has no raw HTML or footnotes: HTML is left out, and footnotes become text.
    decode: {
      nodes: {
        html: () => null,
        footnoteReference: (node) => {
          return { type: "text", text: `[${"label" in node ? node.label : ""}]` };
        },
        footnoteDefinition: (node, context) => {
          return "children" in node ? context.children(node.children) : null;
        }
      }
    }
  });

  return prepareContent(document, {
    imageURL: (image) => String(image.attrs?.assetID),
    linkURL: (href) => href,
    highlight
  });
};

export { highlightCode, prepareContent, prepareMarkdown };
export type { HighlightOptions, PrepareOptions, PreparedContent };
