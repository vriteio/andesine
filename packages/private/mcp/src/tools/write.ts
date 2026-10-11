import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  collectionTarget,
  entryURL,
  resolveCollectionID,
  resolveEntryID,
  runTool,
  saveCheckpoint,
  type ToolContext
} from "../context";

const entrySchema = z.string().describe("Entry ID (ent_...) or path (/Collection/Entry)");
const kindSchema = z.enum(["entry", "collection"]);
const fieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);
const operationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("replaceText"),
    find: z.string().min(1).describe("Text that occurs exactly once in one block's MDX"),
    replace: z.string()
  }),
  z.object({
    type: z.literal("replaceBlock"),
    id: z.string().describe("Block ID from fetch with format blocks"),
    mdx: z.string()
  }),
  z.object({
    type: z.literal("insertBlocks"),
    mdx: z.string(),
    before: z.string().optional().describe("Block ID to insert before"),
    after: z.string().optional().describe("Block ID to insert after"),
    position: z.enum(["start", "end"]).optional(),
    fragment: z.string().optional().describe("Fragment key for position")
  }),
  z.object({ type: z.literal("deleteBlocks"), ids: z.array(z.string()).min(1) }),
  z.object({
    type: z.literal("setField"),
    key: z.string().describe("Field name or key"),
    value: fieldValueSchema.describe("Property value, or MDX for a fragment")
  })
]);
const versionName = (name?: string) => (name ? { name } : {});

const registerCreateEntry = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "create_entry",
    {
      title: "Create an entry",
      description:
        "Creates an entry. Give path (/Collection/Entry; missing collections are created) or collection and name. mdx sets the content (the H1 is the title); fields sets schema fields by name. Images must be asset: references here; add images by URL later with edit_entry.",
      inputSchema: {
        path: z.string().optional().describe("Full path of the new entry"),
        collection: z.string().optional().describe("Existing parent collection ID or path"),
        name: z.string().optional(),
        mdx: z.string().optional(),
        fields: z.record(z.string(), fieldValueSchema).optional()
      },
      annotations: {
        title: "Create an entry",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    runTool(async ({ path, collection, name, mdx, fields }) => {
      if (name && mdx !== undefined) {
        throw new Error("Use name or mdx, not both: the MDX H1 is the entry's name");
      }

      const entry = await context.client.entries.create({
        ...(path ? { path } : {}),
        ...(collection ? collectionTarget(collection) : {}),
        ...(name ? { name } : {}),
        mdx,
        fields
      });

      // A new entry has nothing to restore.
      await context.checkpoints.claim(entry.id);

      return { id: entry.id, name: entry.name, path: entry.path, url: entryURL(context, entry.id) };
    })
  );
};
const registerEditEntry = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "edit_entry",
    {
      title: "Edit an entry",
      description:
        "Changes parts of an entry with operations, applied in order; all or none apply. Use this for all changes to existing content. replaceText needs text that occurs once in one block; block IDs come from fetch with format blocks. Live edits by people in other blocks are kept. name also renames the entry.",
      inputSchema: {
        entry: entrySchema,
        operations: z.array(operationSchema).min(1),
        expectedHash: z
          .string()
          .optional()
          .describe("Hash from fetch; the edit fails if the content changed since"),
        name: z.string().optional().describe("New name and title"),
        versionName: z.string().optional().describe("Also save the result as a named version")
      },
      annotations: {
        title: "Edit an entry",
        readOnlyHint: false,
        // Operations can replace and remove content.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    runTool(async ({ entry, operations, expectedHash, name, versionName: version }) => {
      const id = await resolveEntryID(context, entry);

      await saveCheckpoint(context, id);

      const result = await context.client.entries.update({
        id,
        operations,
        expectedHash,
        name,
        ...(version !== undefined && { version: versionName(version) })
      });

      return { id, hash: result.hash, version: result.version, url: entryURL(context, id) };
    })
  );
};
const registerWriteEntry = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "write_entry",
    {
      title: "Replace an entry's content",
      description:
        "Replaces the whole content of an entry with MDX. Use only for full rewrites or when asked; prefer edit_entry. Needs expectedHash from fetch. Unchanged blocks keep their IDs.",
      inputSchema: {
        entry: entrySchema,
        mdx: z.string(),
        expectedHash: z.string().describe("Hash from fetch"),
        versionName: z.string().optional().describe("Also save the result as a named version")
      },
      annotations: {
        title: "Replace an entry's content",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    runTool(async ({ entry, mdx, expectedHash, versionName: version }) => {
      const id = await resolveEntryID(context, entry);

      await saveCheckpoint(context, id);

      const result = await context.client.entries.update({
        id,
        mdx,
        expectedHash,
        ...(version !== undefined && { version: versionName(version) })
      });

      return { id, hash: result.hash, version: result.version, url: entryURL(context, id) };
    })
  );
};
const registerMove = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "move",
    {
      title: "Rename or move",
      description:
        "Renames an entry or a collection, moves it to another collection (to; / is the top level), or both.",
      inputSchema: {
        kind: kindSchema,
        target: z.string().describe("ID or path of the entry or collection"),
        name: z.string().optional().describe("New name"),
        to: z.string().optional().describe("New parent collection ID or path")
      },
      annotations: {
        title: "Rename or move",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    runTool(async ({ kind, target, name, to }) => {
      if (kind === "entry") {
        const id = await resolveEntryID(context, target);

        if (name) await context.client.entries.update({ id, name });
        if (to) await context.client.entries.move({ id, ...collectionTarget(to) });

        return { id, url: entryURL(context, id) };
      }

      const id = await resolveCollectionID(context, target);

      if (name) await context.client.collections.update({ id, name });

      if (to) {
        const parent = collectionTarget(to);

        await context.client.collections.move({
          id,
          ...("collectionID" in parent
            ? { newParentID: parent.collectionID }
            : { newParentPath: parent.collectionPath })
        });
      }

      return { id };
    })
  );
};
const registerDelete = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "delete",
    {
      title: "Delete",
      description: "Deletes an entry, or a collection with everything in it.",
      inputSchema: {
        kind: kindSchema,
        target: z.string().describe("ID or path of the entry or collection")
      },
      annotations: {
        title: "Delete",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    runTool(async ({ kind, target }) => {
      if (kind === "entry") {
        const id = await resolveEntryID(context, target);

        await context.client.entries.delete({ id });

        return { deleted: id };
      }

      const id = await resolveCollectionID(context, target);

      await context.client.collections.delete({ id });

      return { deleted: id };
    })
  );
};
const registerSaveVersion = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "save_version",
    {
      title: "Save a version",
      description:
        "Saves a version of an entry's current content, or of supplied MDX without changing the content.",
      inputSchema: {
        entry: entrySchema,
        name: z.string().max(100).optional(),
        mdx: z.string().optional().describe("Content of the version, instead of the current one")
      },
      annotations: {
        title: "Save a version",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    runTool(async ({ entry, name, mdx }) => {
      const entryID = await resolveEntryID(context, entry);
      const version = await context.client.versions.create({ entryID, name, mdx });

      return { id: version.id, name: version.name, hash: version.hash };
    })
  );
};
const registerRevertVersion = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "revert_version",
    {
      title: "Restore a version",
      description:
        "Restores an entry to a saved version. Unsaved current content is saved as a version first.",
      inputSchema: { version: z.string().describe("Version ID (ver_...)") },
      annotations: {
        title: "Restore a version",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    runTool(async ({ version }) => ({ ...(await context.client.versions.revert({ id: version })) }))
  );
};

const writeTools = {
  create_entry: registerCreateEntry,
  edit_entry: registerEditEntry,
  write_entry: registerWriteEntry,
  move: registerMove,
  delete: registerDelete,
  save_version: registerSaveVersion,
  revert_version: registerRevertVersion
};

export { writeTools };
