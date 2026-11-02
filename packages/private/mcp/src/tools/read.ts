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
import { getSchemaFieldName, type ResolvedSchemaField } from "@andesine/contracts/schema";
import { getHeadings, getSections } from "./sections";

interface TreeCollection {
  id: string;
  name: string;
  path: string;
  // Missing when the schema state is unavailable, e.g. during a schema migration.
  schemaEnabled?: boolean;
  // Missing when the depth limit stopped the listing.
  collections?: TreeCollection[];
  entries?: Array<{ id: string; name: string; path: string }>;
}

type SearchResult = Awaited<
  ReturnType<ToolContext["client"]["search"]["current"]>
>["results"][number];

const MAX_TREE_DEPTH = 3;
const MAX_TREE_ITEMS = 300;
const PAGE_SIZE = 100;
const MAX_SECTIONS = 20;
const TREE_LEVEL_CONCURRENCY = 5;

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
        "Reads an entry as MDX (default), ProseMirror JSON, or blocks. The result has the content hash for edits, the linked entries (references), and the schema. Use format blocks before edit_entry operations that need block IDs. For long current drafts, use format outline to list the headings, and section to read one or more parts as MDX or blocks; these partial reads return only the path and the hash as metadata.",
      inputSchema: {
        id: z.string().describe("Entry ID (ent_...) or path (/Collection/Entry)"),
        scope: scopeSchema,
        channel: channelSchema,
        version: z.string().optional().describe("Version ID (ver_...) to read instead"),
        format: z.enum(["mdx", "json", "blocks", "outline"]).default("mdx"),
        section: z
          .union([z.string().min(1), z.array(z.string().min(1)).min(1).max(MAX_SECTIONS)])
          .optional()
          .describe(
            "One or more sections, each a heading's text, path (Parent > Child, as search returns it), or block ID. Each reads up to the next heading of the same or a higher level. Sections come in document order, and any unknown section fails the read."
          )
      },
      annotations: { ...readAnnotations, title: "Read an entry" }
    },
    runTool(async ({ id, scope, channel, version, format, section }) => {
      const partial = format === "outline" || section !== undefined;
      const readsOtherContent = version || scope === "published";
      const needsCurrentDraft = partial || format === "blocks";

      if (needsCurrentDraft && readsOtherContent) {
        throw new Error("format blocks, format outline, and section only read the current draft");
      }

      if (format === "json" && section !== undefined) {
        throw new Error("section reads MDX or blocks, not json");
      }

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
        contentFormat: partial ? "blocks" : format
      });
      const allBlocks = entry.blocks ?? [];
      const blocks = section ? getSections(allBlocks, [section].flat()) : allBlocks;
      const base = { id: entry.id, title: entry.name, url: entryURL(context, entry.id) };
      const metadata = {
        path: entry.path,
        slugPath: entry.slugPath,
        hash: entry.hash,
        ...(!partial && { references: entry.references, schema: entry.schema })
      };

      if (format === "outline") {
        return {
          ...base,
          headings: getHeadings(blocks).map(({ id: headingID, level, text }) => {
            return { id: headingID, level, text };
          }),
          metadata
        };
      }

      if (format === "blocks") return { ...base, blocks, metadata };

      return {
        ...base,
        text: section
          ? blocks.map((block) => block.mdx).join("\n\n")
          : format === "json"
            ? JSON.stringify(entry.content)
            : (entry.mdx ?? ""),
        metadata
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
        "Lists the collections and entries under a collection path, to the given depth. schemaEnabled tells whether a collection has a schema, also an inherited one. A collection at the depth limit has no collections or entries fields, because they weren't listed. Large trees are cut at 300 items with truncated set; narrow the path to see more.",
      inputSchema: {
        path: z.string().default("/").describe("Collection path, or / for the top level"),
        depth: z.number().int().min(1).max(MAX_TREE_DEPTH).default(1)
      },
      annotations: { ...readAnnotations, title: "List collections and entries" }
    },
    runTool(async ({ path, depth }) => {
      const root: TreeCollection = {
        id: "",
        name: "",
        path: path.replace(/\/+$/, "") || "/",
        collections: [],
        entries: []
      };

      const metadata = await context.client.typeMetadata
        .getCurrent(root.path === "/" ? {} : { collections: [root.path] })
        .catch(() => null);
      const schemaEnabled = new Map(
        (metadata?.collections ?? []).map(({ path: collectionPath, schemaRevisionIDs }) => {
          return [collectionPath, schemaRevisionIDs.some(Boolean)];
        })
      );

      let level = [root];
      let items = 0;
      let truncated = false;

      for (let nodeDepth = 0; nodeDepth < depth; nodeDepth += 1) {
        for (let start = 0; start < level.length; start += TREE_LEVEL_CONCURRENCY) {
          if (items >= MAX_TREE_ITEMS) {
            truncated = true;
            break;
          }

          await Promise.all(
            level.slice(start, start + TREE_LEVEL_CONCURRENCY).map(async (node) => {
              const [listed, page] = await Promise.all([
                listCollections(context, node.path),
                context.client.entries.list({ collectionPath: node.path, limit: PAGE_SIZE })
              ]);

              const listedCollections = listed.collections.slice(0, MAX_TREE_ITEMS - items);
              const listedEntries = page.data.slice(
                0,
                MAX_TREE_ITEMS - items - listedCollections.length
              );

              node.collections = listedCollections.map(({ id, name, path: collectionPath }) => {
                return {
                  id,
                  name,
                  path: collectionPath,
                  schemaEnabled: schemaEnabled.get(collectionPath)
                };
              });
              node.entries = listedEntries.map(({ id, name, path: entryPath }) => {
                return { id, name, path: entryPath };
              });
              items += node.collections.length + node.entries.length;
              truncated ||=
                listed.truncated ||
                page.pagination.hasMore ||
                listedCollections.length < listed.collections.length ||
                listedEntries.length < page.data.length;
            })
          );
        }

        level = level.flatMap((node) => node.collections ?? []);
      }

      return { path: root.path, collections: root.collections, entries: root.entries, truncated };
    })
  );
};
const toFieldSummary = (field: ResolvedSchemaField) => {
  const shared = {
    id: field.id,
    ...(field.source.inherited && { inherited: true }),
    kind: field.kind,
    name: getSchemaFieldName(field),
    ...(field.optional && { optional: true })
  };

  if (field.kind === "fragment") return { ...shared, allowedBlocks: field.allowedBlocks };

  return {
    ...shared,
    type: field.type,
    ...(field.options.length > 0 && { options: field.options }),
    ...(field.initialValue !== "" && { initialValue: field.initialValue })
  };
};
const registerGetSchema = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "get_schema",
    {
      title: "Get a collection schema",
      description:
        "Returns the schema fields of a collection, also inherited ones: properties with their types, and fragments with their allowed blocks. Fields are required unless optional is true; entries can leave out optional fields. Field names are the ones to use in MDX and create_entry fields. Use detail full for the drafts and initial content, or version to read a saved schema version from list_versions.",
      inputSchema: {
        collection: z.string().optional().describe("Collection ID (coll_...) or path"),
        detail: z.enum(["summary", "full"]).default("summary"),
        version: z.string().optional().describe("Schema version ID (schv_...) to read instead")
      },
      annotations: { ...readAnnotations, title: "Get a collection schema" }
    },
    runTool(async ({ collection, detail, version }) => {
      if (version) {
        const { document: _document, ...details } = await context.client.schemaVersions.get({
          id: version
        });

        return { version: details };
      }

      if (!collection) throw new Error("Use collection or version");

      const schema = await context.client.schemas.get(collectionTarget(collection));

      if (detail === "full") return { schema };

      return {
        enabled: Boolean(schema.effective),
        inherited: schema.effective?.inherited ?? false,
        hasUnappliedChanges: Boolean(schema.local?.enabled && schema.local.hasUnappliedChanges),
        fields: (schema.effective?.definition.fields ?? []).map(toFieldSummary)
      };
    })
  );
};
const registerGetMigration = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "get_migration",
    {
      title: "Get a schema migration",
      description:
        "Returns the status and progress of a schema migration, by its ID. When it's completed, it also lists up to 100 entries that lost content; pass nextCursor as cursor for more.",
      inputSchema: {
        id: z.string().describe("Migration ID (smg_...)"),
        cursor: z.string().optional().describe("nextCursor from the previous result")
      },
      annotations: { ...readAnnotations, title: "Get a schema migration" }
    },
    runTool(async ({ id, cursor }) => {
      const migration = await context.client.schemaMigrations.get({ id });
      const contentLoss =
        migration.status === "completed"
          ? await context.client.schemaMigrations.listContentLossEntries({
              id,
              cursor,
              limit: PAGE_SIZE
            })
          : null;

      return {
        id: migration.id,
        status: migration.status,
        processedEntries: migration.processedEntries,
        totalEntries: migration.totalEntries,
        error: migration.error,
        ...(contentLoss && {
          contentLossEntries: contentLoss.data,
          nextCursor: contentLoss.pagination.nextCursor
        })
      };
    })
  );
};
const registerListVersions = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "list_versions",
    {
      title: "List versions",
      description:
        "Lists saved versions of an entry, or of a collection's own schema, newest first.",
      inputSchema: {
        entry: z.string().optional().describe("Entry ID (ent_...) or path"),
        collection: z.string().optional().describe("Collection ID (coll_...) or path"),
        cursor: z.string().optional().describe("Cursor from the previous page"),
        limit: z.number().int().min(1).max(100).default(20)
      },
      annotations: { ...readAnnotations, title: "List versions" }
    },
    runTool(async ({ entry, collection, cursor, limit }) => {
      if (Boolean(entry) === Boolean(collection)) throw new Error("Use entry or collection");

      if (collection) {
        const { local } = await context.client.schemas.get(collectionTarget(collection));

        if (!local) {
          throw new Error(
            "The collection has no schema of its own. Inherited schemas have versions on the collection that defines them."
          );
        }

        return {
          ...(await context.client.schemaVersions.list({ schemaID: local.id, cursor, limit }))
        };
      }

      const entryID = await resolveEntryID(context, entry!);

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
  get_migration: registerGetMigration,
  list_versions: registerListVersions,
  list_channels: registerListChannels
};

export { readTools };
