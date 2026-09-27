import type { ContentNode } from "@andesine/converters";
import { toMDX } from "@andesine/converters/mdx";
import { filterVisibility } from "./visibility";

interface MarkdownOptions {
  imageURL(node: ContentNode): Promise<string>;
  /** Maps content links to absolute URLs. */
  linkURL(href: string): string;
}

const rewriteLinks = (node: ContentNode, linkURL: (href: string) => string): ContentNode => {
  return {
    ...node,
    marks: node.marks?.map((mark) => {
      return mark.type === "link" && typeof mark.attrs?.href === "string"
        ? { ...mark, attrs: { ...mark.attrs, href: linkURL(mark.attrs.href) } }
        : mark;
    }),
    content: node.content?.map((child) => rewriteLinks(child, linkURL))
  };
};
/**
 * Converts Andesine documents to the page's Markdown alternative. Elements become MDX
 * components, like in MDX files.
 */
const toPageMarkdown = async (
  documents: ContentNode[],
  options: MarkdownOptions
): Promise<string> => {
  const parts = await Promise.all(
    documents.map((document) => {
      return toMDX(rewriteLinks(document, options.linkURL), {
        title: "omit",
        properties: "omit",
        imageURL: options.imageURL,
        encode: {
          elements: {
            // Agents get the content of agent blocks, without the tags.
            Visibility: (node, context) => {
              return (node.attrs?.props as { for?: string } | undefined)?.for === "agents"
                ? context.children(node)
                : null;
            }
          }
        }
      });
    })
  );

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
};
const toAbsolute = (target: string, base: URL): string => {
  const isAbsolute = /^[a-z][\w+.-]*:/i.test(target);

  return isAbsolute || target.startsWith("{") ? target : new URL(target, base).href;
};
/** Makes link and image targets absolute, outside of inline code. */
const rewriteLine = (line: string, base: URL): string => {
  return line
    .split(/(`+[^`]*`+)/)
    .map((part, index) => {
      return index % 2
        ? part
        : part
            .replace(/(\]\()(<[^>]*>|[^)\s]+)/g, (_, start: string, target: string) => {
              const wrapped = target.startsWith("<");
              const url = toAbsolute(wrapped ? target.slice(1, -1) : target, base);

              return `${start}${wrapped ? `<${url}>` : url}`;
            })
            .replace(
              /^(\s{0,3}\[[^\]]+\]:\s*)(\S+)/,
              (_, start: string, target: string) => `${start}${toAbsolute(target, base)}`
            )
            .replace(
              /\b(href|src)=(["'])([^"']+)\2/g,
              (_, name: string, quote: string, target: string) => {
                return `${name}=${quote}${toAbsolute(target, base)}${quote}`;
              }
            );
    })
    .join("");
};
/**
 * Prepares the source of a file page as its Markdown alternative. It keeps the content for
 * agents, removes the leading MDX `import` and `export` statements, which only work in the
 * build, and makes links absolute.
 */
const toFileMarkdown = (body = "", pageURL: URL): string => {
  let fence: string | undefined;

  return filterVisibility(body, "agents")
    .replace(/^(?:(?:import|export)\s[\s\S]*?(?:\n\s*\n|$))+/, "")
    .split("\n")
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];

      if (fence) {
        const closesFence = marker?.[0] === fence[0] && marker.length >= fence.length;

        if (closesFence) fence = undefined;

        return line;
      }

      if (marker) {
        fence = marker;

        return line;
      }

      return rewriteLine(line, pageURL);
    })
    .join("\n")
    .trim();
};

export { toPageMarkdown, toFileMarkdown };
