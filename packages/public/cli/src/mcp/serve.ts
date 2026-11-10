import { createMCPServer, readLocalFile } from "@andesine/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "../../package.json";
import { authenticatedClient, identity } from "../auth/client";
import type { CommandContext } from "../context";
import { CLIError, exitCodes } from "../errors";

interface ServeMCPOptions {
  readOnly?: boolean;
}

/** Runs the MCP server over stdio until the client disconnects; stdout carries only MCP messages. */
const serveMCP = async (context: CommandContext, options: ServeMCPOptions): Promise<void> => {
  const { client } = await authenticatedClient(context, true);
  const account = await identity(client, context.signal);

  if (account.type !== "key" && !context.config.workspaceID) {
    throw new CLIError(
      "Select a workspace for the MCP server: run andesine init in the project, or pass --workspace <id>.",
      exitCodes.usage
    );
  }

  const server = await createMCPServer({
    client,
    workspaceID: context.config.workspaceID,
    readOnly: options.readOnly,
    readLocalFile,
    version
  });
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    transport.onclose = resolve;
    process.stdin.once("end", resolve);
    context.signal.addEventListener("abort", () => resolve(), { once: true });
  });

  await server.connect(transport);
  await closed;
  await server.close();
};

export { serveMCP };
