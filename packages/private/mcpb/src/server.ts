import { createMCPServer, readLocalFile } from "@andesine/mcp";
import { createClient } from "@andesine/sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "../package.json";

// Claude Desktop passes the extension settings as environment variables (manifest.json).
const client = createClient({
  baseURL: process.env.ANDESINE_BASE_URL || undefined,
  apiKey: process.env.ANDESINE_API_KEY
});

try {
  const server = await createMCPServer({
    client,
    readOnly: process.env.ANDESINE_READ_ONLY === "true",
    readLocalFile,
    version
  });

  await server.connect(new StdioServerTransport());
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);

  // Claude Desktop shows stderr in its MCP logs.
  console.error(
    `Andesine: can't start. Check the API key and API URL in the extension settings. ${reason}`
  );
  process.exit(1);
}
