import { createMemoryCheckpointStore, type ToolContext } from "@andesine/mcp/context";
import { readTools } from "@andesine/mcp/tools/read";
import * as z from "zod";
import { client, config } from "#web/lib/api";
import type { WebMCPOptions } from "./index";

/** A tool for in-browser AI agents, after the WebMCP draft (https://webmachinelearning.github.io/webmcp/). */
interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute(input: Record<string, unknown>): Promise<unknown>;
}

interface ModelContext {
  registerTool(tool: ModelContextTool, options: { signal: AbortSignal }): Promise<void>;
}

/** The parts of an MCP tool definition and result that the read tools use. */
interface MCPToolConfig {
  title?: string;
  description?: string;
  inputSchema?: z.ZodRawShape;
}

interface MCPToolResult {
  content: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

type MCPServer = Parameters<(typeof readTools)["search"]>[0];

/** Runs the MCP read tools, which the API checks with the user's session, as WebMCP tools. */
const registerTools = (options: WebMCPOptions): void => {
  const { modelContext } = document as Document & { modelContext: ModelContext };
  const context: ToolContext = {
    // Same API methods; the SDK only adds `atSnapshot` and `response: "full"`, unused here.
    client: client as unknown as ToolContext["client"],
    appURL: config.PUBLIC_APP_URL,
    workspaceID: options.workspaceID,
    // shortcut: keyword search by default, as in the app's search; agents can pass `semantic`.
    semanticSearch: false,
    clientName: () => "a browser agent",
    checkpoints: createMemoryCheckpointStore()
  };
  const register = (tool: ModelContextTool): void => {
    modelContext
      .registerTool(tool, { signal: options.signal })
      .catch((error: unknown) => console.warn(error));
  };
  const server = {
    registerTool: (
      name: string,
      tool: MCPToolConfig,
      handler: (input: unknown) => Promise<MCPToolResult>
    ) => {
      const schema = z.object(tool.inputSchema ?? {});

      register({
        name,
        title: tool.title,
        description: tool.description ?? name,
        inputSchema: z.toJSONSchema(schema, { io: "input" }),
        annotations: { readOnlyHint: true },
        // The browser hides rejection reasons from agents, so errors are results.
        execute: async (input) => {
          const parsed = schema.safeParse(input);

          if (!parsed.success) return { error: z.prettifyError(parsed.error) };

          const result = await handler(parsed.data);
          const text = result.content.map((item) => item.text ?? "").join("\n");

          if (result.isError) return { error: text };

          return result.structuredContent ?? text;
        }
      });
    }
  } as unknown as MCPServer;

  Object.values(readTools).forEach((registerTool) => registerTool(server, context));
  register({
    name: "get_open_entry",
    title: "Get the open entry",
    description:
      "Returns the ID of the entry open in the editor, if any. Use fetch with the ID to read it.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => ({ id: options.openEntryID() ?? null })
  });
  register({
    name: "open_entry",
    title: "Open an entry",
    description: "Opens an entry in the editor, for the user to see.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Entry ID (ent_...)" } },
      required: ["id"]
    },
    annotations: { readOnlyHint: true },
    execute: async ({ id }) => {
      const isEntryID = typeof id === "string" && id.startsWith("ent_");

      if (!isEntryID) return { error: "Use an entry ID (ent_...)." };

      options.openEntry(id);

      return { opened: id };
    }
  });
};

export { registerTools };
