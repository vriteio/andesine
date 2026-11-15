import { createAnswerClient, createSearchClient } from "./client";
import type { WebMCPContext } from "./context";

/** A tool for in-browser AI agents, after the WebMCP draft (https://webmachinelearning.github.io/webmcp/). */
interface ModelContextTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute(
    input: Record<string, string | undefined>,
    options: { signal: AbortSignal }
  ): Promise<unknown>;
}

interface ModelContext {
  registerTool(tool: ModelContextTool): Promise<void>;
}

const annotations = { readOnlyHint: true };

const toInputSchema = (name: string, description: string, required: boolean): object => ({
  type: "object",
  properties: { [name]: { type: "string", description } },
  required: required ? [name] : []
});
const fetchText = async (url: string, signal: AbortSignal): Promise<string> => {
  const response = await fetch(url, { signal });

  if (!response.ok) throw new Error(`${url} is not available (${response.status}).`);

  return response.text();
};
/** The Markdown URL of a site page, e.g. `/guide/` → `/guide/index.md`. */
const toMarkdownURL = (base: string, path = location.pathname): string => {
  const url = new URL(path, location.href);
  // The current page is allowed outside the base, e.g. a landing page that loads the site's tools.
  const isReadable = url.pathname.startsWith(base) || url.pathname === location.pathname;
  const isSitePage = url.origin === location.origin && isReadable;

  if (!isSitePage) throw new Error(`Use a page path on this site, under ${base}.`);

  return url.pathname.replace(/(?:\/index)?(?:\.md)?\/?$/, "/") + "index.md";
};
const createTools = (context: WebMCPContext): ModelContextTool[] => {
  const { base, search } = context;
  const tools: ModelContextTool[] = [
    {
      name: "get_docs_tree",
      title: "List docs pages",
      description:
        "Lists the pages of this documentation site by section, with titles, URLs, and descriptions (the site's llms.txt).",
      inputSchema: { type: "object", properties: {} },
      annotations,
      execute: (_input, { signal }) => fetchText(`${base}llms.txt`, signal)
    },
    {
      name: "get_page",
      title: "Read a docs page",
      description:
        "Reads a page of this documentation site, or the current page, as Markdown. Without a path, reads the current page.",
      inputSchema: toInputSchema("path", "Page path or URL on this site, e.g. /guide/", false),
      annotations,
      execute: ({ path }, { signal }) => fetchText(toMarkdownURL(base, path), signal)
    }
  ];

  if (search) {
    const client = createSearchClient(search);

    tools.push({
      name: "search_docs",
      title: "Search the docs",
      description:
        "Searches this documentation site. Returns matching pages with sections and excerpts; use get_page to read one.",
      inputSchema: toInputSchema("query", "Search query", true),
      annotations,
      execute: async ({ query }, { signal }) => {
        const groups = await client.search(query!, signal);

        return groups.map((group) => ({
          source: group.label,
          error: group.error,
          results: group.items.map((item) => ({
            title: item.title,
            url: new URL(item.href, location.href).href,
            section: item.headingPath.join(" > ") || undefined,
            excerpt: item.excerpt
          }))
        }));
      }
    });
  }

  if (search?.answers) {
    const client = createAnswerClient(search.answers);

    tools.push({
      name: "ask_docs",
      title: "Ask the docs",
      description:
        "Answers a question from this documentation site with AI, and lists the pages it used as sources.",
      inputSchema: toInputSchema("question", "Question about the documented product", true),
      annotations,
      execute: async ({ question }, { signal }) => {
        const answer = await client.ask(question!, [], signal, () => {});

        return {
          answer: answer.text,
          sources: answer.sources.map((source) => ({
            id: source.id,
            title: source.title,
            url: new URL(source.href, location.href).href
          }))
        };
      }
    });
  }

  return tools;
};
/** Registers the site's tools for in-browser AI agents; does nothing without WebMCP support. */
const registerWebMCPTools = (context: WebMCPContext): void => {
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;

  if (!modelContext) return;

  for (const tool of createTools(context)) {
    // The browser hides rejection reasons from agents, so errors are results.
    const execute: ModelContextTool["execute"] = async (input, options) => {
      try {
        return await tool.execute(input, options);
      } catch (error) {
        return { error: (error as Error).message };
      }
    };

    modelContext.registerTool({ ...tool, execute }).catch((error: unknown) => console.warn(error));
  }
};

/**
 * Registers the tools of a Pages site on another page of the same origin, e.g. a landing page,
 * from the site's `_andesine/webmcp.json`. `siteURL` is the site's base URL, e.g. `/docs/`.
 */
const loadWebMCPTools = async (siteURL: string): Promise<void> => {
  if (!("modelContext" in document)) return;

  const response = await fetch(new URL("_andesine/webmcp.json", new URL(siteURL, location.href)));

  if (!response.ok) throw new Error(`The WebMCP tools of ${siteURL} are not available.`);

  registerWebMCPTools((await response.json()) as WebMCPContext);
};

export { loadWebMCPTools, registerWebMCPTools };
export type { WebMCPContext };
