import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { resolveCollectionID, resolveEntryID, runTool, type ToolContext } from "../context";

const targetSchema = {
  kind: z.enum(["entry", "collection"]).describe("collection publishes or unpublishes its tree"),
  target: z.string().describe("ID or path of the entry or collection"),
  channel: z.string().default("published").describe("Publishing channel code")
};
const publishAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true
};

const registerPublish = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "publish",
    {
      title: "Publish",
      description:
        "Publishes the current content of an entry, or a collection tree, to a channel, where sites and readers see it. version publishes a saved entry version instead.",
      inputSchema: {
        ...targetSchema,
        version: z.string().optional().describe("Version ID (ver_...) of the entry to publish")
      },
      annotations: { ...publishAnnotations, title: "Publish" }
    },
    runTool(async ({ kind, target, channel, version }) => {
      if (kind === "entry") {
        const entryID = await resolveEntryID(context, target);

        const result = await context.client.publishing.publishEntry({
          entryID,
          channel,
          versionID: version
        });

        return { published: entryID, channel, result: result ?? null };
      }

      const collectionID = await resolveCollectionID(context, target);

      const result = await context.client.publishing.publishCollection({ collectionID, channel });

      return { published: collectionID, channel, result: result ?? null };
    })
  );
};
const registerUnpublish = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "unpublish",
    {
      title: "Unpublish",
      description: "Removes an entry, or a collection tree, from a channel.",
      inputSchema: targetSchema,
      annotations: { ...publishAnnotations, title: "Unpublish" }
    },
    runTool(async ({ kind, target, channel }) => {
      if (kind === "entry") {
        const entryID = await resolveEntryID(context, target);

        const result = await context.client.publishing.unpublishEntry({ entryID, channel });

        return { unpublished: entryID, channel, result: result ?? null };
      }

      const collectionID = await resolveCollectionID(context, target);

      const result = await context.client.publishing.unpublishCollection({ collectionID, channel });

      return { unpublished: collectionID, channel, result: result ?? null };
    })
  );
};

const publishTools = { publish: registerPublish, unpublish: registerUnpublish };

export { publishTools };
