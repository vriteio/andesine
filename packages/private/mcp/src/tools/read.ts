import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  collectionTarget,
  entrySelector,
  entryURL,
  resolveEntryID,
  runTool,
  type ToolContext
} from "../context";

interface TreeCollection {
  id: string;
  name: string;
  path: string;
  collections: TreeCollection[];
  entries: Array<{ id: string; name: string; path: string }>;
}

type SearchResult = Awaited<
  ReturnType<ToolContext["client"]["search"]["current"]>
>["results"][number];

const MAX_TREE_DEPTH = 3;
const MAX_TREE_ITEMS = 300;
const PAGE_SIZE = 100;

const scopeSchema = z
  .enum(["current", "published"])
  .default("current")
  .describe("current: drafts as people see them in the editor; published: content on a channel");
const channelSchema = z
  .string()
  .optional()
  .describe("Publishing channel code for published scope (default: published)");
const readAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

const registerSearch = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "search",
    {
      title: "Search content",
      description:
        "Searches the workspace and returns matching entries with snippets. Use fetch with a result id to read an entry.",
      inputSchema: {
        query: z.string().min(1).max(500).describe("Search query"),
        semantic: z
          .boolean()
          .optional()
          .describe("Combine keyword and meaning-based search (default: on when available)"),
        scope: scopeSchema,
        channel: channelSchema,
        collection: z
          .string()
          .optional()
          .describe("Limit to a collection by ID (coll_...) or path, including nested entries"),
        limit: z.number().int().min(1).max(50).default(10)
      },
      annotations: { ...readAnnotations, title: "Search content" }
    },
    runTool(async ({ query, semantic, scope, channel, collection, limit }) => {
      const input = {
        query,
        limit,
        semantic: semantic ?? context.semanticSearch,
        ...(collection ? collectionTarget(collection) : {})
      };
      const { results } =
        scope === "published"
          ? await context.client.search.published({ ...input, channel: channel ?? "published" })
          : await context.client.search.current(input);

      return {
        results: results.map((result: SearchResult) => ({
          id: result.entryID,
          title: result.title,
          url: entryURL(context, result.entryID),
          path: result.path,
          section: result.headingPath.join(" > ") || undefined,
          snippet: result.snippet
        }))
      };
    })
  );
};
const registerFetch = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "fetch",
    {
      title: "Read an entry",
      description:
        "Reads an entry as MDX (default), ProseMirror JSON, or blocks. The result has the content hash for edits, the linked entries (references), and the schema. Use format blocks before edit_entry operations that need block IDs.",
      inputSchema: {
        id: z.string().describe("Entry ID (ent_...) or path (/Collection/Entry)"),
        scope: scopeSchema,
        channel: channelSchema,
        version: z.string().optional().describe("Version ID (ver_...) to read instead"),
        format: z.enum(["mdx", "json", "blocks"]).default("mdx")
      },
      annotations: { ...readAnnotations, title: "Read an entry" }
    },
    runTool(async ({ id, scope, channel, version, format }) => {
      if (version) {
        const details = await context.client.versions.get({
          id: version,
          contentFormat: format === "json" ? "json" : "mdx"
        });

        return {
          id: details.entryID,
          title: details.entryName,
          text: details.mdx ?? JSON.stringify(details.document),
          url: entryURL(context, details.entryID),
          metadata: { versionID: details.id, hash: details.hash, references: details.references }
        };
      }

      if (scope === "published") {
        const selector = entrySelector(id);
        const published = await context.client.content.get({
          ...("id" in selector ? { entryID: selector.id } : { path: selector.path }),
          channel,
          contentFormat: format === "json" ? "json" : "mdx"
        });

        return {
          id: published.id,
          title: published.name,
          text: published.mdx ?? JSON.stringify(published.content),
          url: entryURL(context, published.id),
          metadata: {
            path: published.path,
            slugPath: published.slugPath,
            channel: published.channel
          }
        };
      }

      const entry = await context.client.entries.get({
        ...entrySelector(id),
        contentFormat: format
      });
      const text =
        format === "json"
          ? JSON.stringify(entry.content)
          : format === "blocks"
            ? (entry.blocks ?? []).map((block) => block.mdx).join("\n\n")
            : (entry.mdx ?? "");

      return {
        id: entry.id,
        title: entry.name,
        text,
        url: entryURL(context, entry.id),
        ...(entry.blocks && { blocks: entry.blocks }),
        metadata: {
          path: entry.path,
          slugPath: entry.slugPath,
          hash: entry.hash,
          references: entry.references,
          schema: entry.schema
        }
      };
    })
  );
};
const listCollections = async (context: ToolContext, path: string) => {
  const collections: Array<{ id: string; name: string; path: string }> = [];

  let cursor: string | undefined;

  do {
    const page = await context.client.collections.list({
      collectionPath: path,
      cursor,
      limit: PAGE_SIZE
    });

    collections.push(...page.data);
    cursor = page.pagination.nextCursor ?? undefined;
  } while (cursor && collections.length < MAX_TREE_ITEMS);

  return { collections, truncated: Boolean(cursor) };
};
const registerGetTree = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "get_tree",
    {
      title: "List collections and entries",
      description:
        "Lists the collections and entries under a collection path, to the given depth. Large trees are cut at 300 items; narrow the path to see more.",
      inputSchema: {
        path: z.string().default("/").describe("Collection path, or / for the top level"),
        depth: z.number().int().min(1).max(MAX_TREE_DEPTH).default(1)
      },
      annotations: { ...readAnnotations, title: "List collections and entries" }
    },
    runTool(async ({ path, depth }) => {
      const base = path.replace(/\/+$/, "") || "/";
      const baseDepth = base === "/" ? 0 : base.split("/").length - 1;
      const listed = await listCollections(context, base);
      const collections = listed.collections.filter((collection) => {
        return collection.path.split("/").length - 1 - baseDepth <= depth;
      });
      const nodes = new Map<string, TreeCollection>(
        collections.map(({ id, name, path: collectionPath }) => [
          collectionPath,
          { id, name, path: collectionPath, collections: [], entries: [] }
        ])
      );
      const root: TreeCollection = { id: "", name: "", path: base, collections: [], entries: [] };
      const parentOf = (node: TreeCollection) => {
        return nodes.get(node.path.replace(/\/[^/]+$/, "") || "/") ?? root;
      };

      let items = 0;
      let truncated = listed.truncated;

      for (const node of nodes.values()) parentOf(node).collections.push(node);

      for (const node of [root, ...nodes.values()]) {
        const nodeDepth = node === root ? 0 : node.path.split("/").length - 1 - baseDepth;

        if (nodeDepth >= depth || items >= MAX_TREE_ITEMS) {
          truncated ||= items >= MAX_TREE_ITEMS;
          continue;
        }

        const page = await context.client.entries.list({
          collectionPath: node.path,
          limit: PAGE_SIZE
        });

        node.entries = page.data.map(({ id, name, path: entryPath }) => ({
          id,
          name,
          path: entryPath
        }));
        items += node.entries.length;
        truncated ||= page.pagination.hasMore;
      }

      return { path: base, collections: root.collections, entries: root.entries, truncated };
    })
  );
};
const registerGetSchema = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "get_schema",
    {
      title: "Get a collection schema",
      description:
        "Returns the schema fields of a collection: properties and fragments, with their types and whether they are required.",
      inputSchema: {
        collection: z.string().describe("Collection ID (coll_...) or path")
      },
      annotations: { ...readAnnotations, title: "Get a collection schema" }
    },
    runTool(async ({ collection }) => {
      return { schema: await context.client.schemas.get(collectionTarget(collection)) };
    })
  );
};
const registerListVersions = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "list_versions",
    {
      title: "List entry versions",
      description: "Lists saved versions of an entry, newest first.",
      inputSchema: {
        entry: z.string().describe("Entry ID (ent_...) or path"),
        cursor: z.string().optional().describe("Cursor from the previous page"),
        limit: z.number().int().min(1).max(100).default(20)
      },
      annotations: { ...readAnnotations, title: "List entry versions" }
    },
    runTool(async ({ entry, cursor, limit }) => {
      const entryID = await resolveEntryID(context, entry);

      return { ...(await context.client.versions.list({ entryID, cursor, limit })) };
    })
  );
};
const registerListChannels = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "list_channels",
    {
      title: "List publishing channels",
      description: "Lists the publishing channels of the workspace.",
      inputSchema: {},
      annotations: { ...readAnnotations, title: "List publishing channels" }
    },
    runTool(async () => ({ channels: await context.client.publishing.listChannels({}) }))
  );
};

const readTools = {
  search: registerSearch,
  fetch: registerFetch,
  get_tree: registerGetTree,
  get_schema: registerGetSchema,
  list_versions: registerListVersions,
  list_channels: registerListChannels
};

export { readTools };
