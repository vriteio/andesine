import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { completeChannel, completePath } from "./completion";
import { formatElementsGuide } from "./elements-guide";
import { MDX_GUIDE } from "./guide";
import type { ToolContext } from "./context";

type ResourceName = "workspace" | "entries" | "published" | "schema" | "guide" | "elements";
type TypeMetadata = Awaited<ReturnType<ToolContext["client"]["typeMetadata"]["getCurrent"]>>;

const OVERVIEW_DEPTH = 2;
const MAX_LISTED_ENTRIES = 100;

const textResource = (uri: URL, text: string, mimeType = "text/markdown"): ReadResourceResult => {
  return { contents: [{ uri: uri.href, mimeType, text }] };
};
/** The `{+path}` variable of a resource URI as a name path. */
const readPath = (value: string | string[]): string => {
  return `/${decodeURIComponent([value].flat().join("/")).replace(/^\/+|\/+$/g, "")}`;
};
/** Field names and types of each collection's schema, from one type metadata call. */
const getSchemaSummaries = (metadata: TypeMetadata | null): Map<string, string> => {
  const revisions = new Map(
    (metadata?.revisions ?? []).map(({ revisionID, definition }) => {
      const fields = definition.fields.map((field) => {
        return `${field.label} (${field.kind === "fragment" ? "fragment" : field.type})`;
      });

      return [revisionID, fields.join(", ")];
    })
  );

  return new Map(
    (metadata?.collections ?? []).flatMap(({ path, schemaRevisionIDs }) => {
      const summaries = schemaRevisionIDs.flatMap((id) => (id && revisions.get(id)) || []);

      return summaries.length === 1 ? [[path, summaries[0]]] : [];
    })
  );
};
const encodePath = (path: string): string => {
  return path.replace(/^\//, "").split("/").map(encodeURIComponent).join("/");
};

const registerWorkspace = (server: McpServer, context: ToolContext) => {
  server.registerResource(
    "workspace",
    "andesine://workspace",
    {
      title: "Workspace overview",
      description: "Top collections with their schema fields, publishing channels, and resources",
      mimeType: "text/markdown"
    },
    async (uri) => {
      const [collections, channels, metadata] = await Promise.all([
        context.client.collections.list({ collectionPath: "/", limit: 100 }).catch(() => null),
        context.client.publishing.listChannels({}).catch(() => null),
        context.client.typeMetadata.getCurrent({}).catch(() => null)
      ]);
      const schemas = getSchemaSummaries(metadata);
      const collectionLines = (collections?.data ?? [])
        .filter(({ path }) => path.split("/").length - 1 <= OVERVIEW_DEPTH)
        .map(({ id, path }) => {
          const schema = schemas.get(path);
          const line = `${"  ".repeat(path.split("/").length - 2)}- ${path} (${id})`;

          return schema ? `${line}: fields ${schema}` : line;
        });
      const channelLines = (channels ?? []).map(({ code, name }) => `- ${code}: ${name}`);
      const text = [
        "# Workspace overview",
        "",
        "## Collections",
        "",
        ...(collectionLines.length ? collectionLines : ["No collections, or no access to them."]),
        ...(collections?.pagination.hasMore ? ["", "More collections exist; use get_tree."] : []),
        "",
        "## Publishing channels",
        "",
        ...(channelLines.length ? channelLines : ["No channels, or no access to them."]),
        "",
        "## Content",
        "",
        "- Entries: andesine://entries/{path}, as MDX (see andesine://guide/mdx).",
        "- Published content: andesine://published/{channel}/{path}.",
        "- Collection schemas: andesine://collections/{path}/schema.",
        "- Custom elements and their rules: andesine://guide/elements."
      ].join("\n");

      return textResource(uri, text);
    }
  );
};
const registerEntries = (server: McpServer, context: ToolContext) => {
  server.registerResource(
    "entry",
    new ResourceTemplate("andesine://entries/{+path}", {
      list: async () => {
        const entries = await context.client.entries.list({ limit: MAX_LISTED_ENTRIES });

        return {
          resources: entries.data.map((entry) => ({
            uri: `andesine://entries/${encodePath(entry.path)}`,
            name: entry.path,
            title: entry.name,
            mimeType: "text/markdown"
          }))
        };
      },
      complete: {
        path: (value) => completePath(context, value, { entries: true, relative: true })
      }
    }),
    {
      title: "Entry",
      description: "Entry content as MDX, the current draft as people see it in the editor",
      mimeType: "text/markdown"
    },
    async (uri, { path }) => {
      const entry = await context.client.entries.get({
        path: readPath(path),
        contentFormat: "mdx"
      });

      return textResource(uri, entry.mdx ?? "");
    }
  );
};
const registerPublished = (server: McpServer, context: ToolContext) => {
  server.registerResource(
    "published-entry",
    new ResourceTemplate("andesine://published/{channel}/{+path}", {
      list: undefined,
      complete: {
        channel: (value) => completeChannel(context, value),
        path: (value) => completePath(context, value, { entries: true, relative: true })
      }
    }),
    {
      title: "Published entry",
      description: "Published entry content as MDX on a publishing channel",
      mimeType: "text/markdown"
    },
    async (uri, { channel, path }) => {
      const published = await context.client.content.get({
        path: readPath(path),
        channel: [channel].flat()[0],
        contentFormat: "mdx"
      });

      return textResource(uri, published.mdx ?? "");
    }
  );
};
const registerSchema = (server: McpServer, context: ToolContext) => {
  server.registerResource(
    "collection-schema",
    new ResourceTemplate("andesine://collections/{+path}/schema", {
      list: undefined,
      complete: { path: (value) => completePath(context, value, { relative: true }) }
    }),
    {
      title: "Collection schema",
      description: "Schema fields of a collection: properties and fragments, with their types",
      mimeType: "application/json"
    },
    async (uri, { path }) => {
      const schema = await context.client.schemas.get({ collectionPath: readPath(path) });

      return textResource(uri, JSON.stringify(schema, null, 2), "application/json");
    }
  );
};
const registerGuide = (server: McpServer) => {
  server.registerResource(
    "mdx-guide",
    "andesine://guide/mdx",
    {
      title: "MDX guide",
      description: "The MDX syntax of entries: fields, images, links to entries, and escaping",
      mimeType: "text/markdown"
    },
    async (uri) => textResource(uri, MDX_GUIDE)
  );
};
const registerElements = (server: McpServer, context: ToolContext) => {
  server.registerResource(
    "elements-guide",
    "andesine://guide/elements",
    {
      title: "Custom elements",
      description:
        "The workspace's custom elements, e.g. Tabs: how to write them, their props, and which blocks their content accepts",
      mimeType: "text/markdown"
    },
    async (uri) => {
      const elements = await context.client.extensions.listElements({}).catch(() => []);

      return textResource(uri, formatElementsGuide(elements));
    }
  );
};

const resources: Record<ResourceName, (server: McpServer, context: ToolContext) => void> = {
  workspace: registerWorkspace,
  entries: registerEntries,
  published: registerPublished,
  schema: registerSchema,
  guide: registerGuide,
  elements: registerElements
};

export { resources };
export type { ResourceName };
