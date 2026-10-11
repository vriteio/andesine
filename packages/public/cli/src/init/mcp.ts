import { lstat, stat } from "node:fs/promises";
import path from "node:path";
import { confirm } from "@clack/prompts";
import type { CommandContext } from "../context";
import { CancelledError, CLIError, exitCodes } from "../errors";
import { readProjectFile, writeProjectConfig } from "./write-config";

interface MCPClientConfig {
  client: string;
  /** Relative to the project directory. */
  file: string;
  /** Written only when this directory exists, so only clients in use are configured. */
  directory?: string;
  format: "json" | "toml";
  serversKey?: string;
}
interface MCPConfigChange {
  client: string;
  file: string;
  status: "create" | "update" | "unchanged" | "linked";
}

const STATUS_LABELS: Record<MCPConfigChange["status"], string> = {
  create: "create",
  update: "add the andesine server",
  unchanged: "already configured",
  linked: "a linked file; add the andesine server yourself"
};
const SERVER_NAME = "andesine";
const SERVER_COMMAND = "npx";
// Claude Code and VS Code read .mcp.json; the others have their own files.
const MCP_CLIENTS: MCPClientConfig[] = [
  { client: "Claude Code, VS Code", file: ".mcp.json", format: "json", serversKey: "mcpServers" },
  {
    client: "Cursor",
    file: ".cursor/mcp.json",
    directory: ".cursor",
    format: "json",
    serversKey: "mcpServers"
  },
  {
    client: "Gemini CLI",
    file: ".gemini/settings.json",
    directory: ".gemini",
    format: "json",
    serversKey: "mcpServers"
  },
  { client: "Codex", file: ".codex/config.toml", directory: ".codex", format: "toml" }
];

// The workspace is in the arguments: clients don't always start servers in the project directory.
const getServer = (workspaceID: string) => ({
  command: SERVER_COMMAND,
  args: ["-y", "andesine", "mcp", "--workspace", workspaceID]
});
const getTOMLSection = (workspaceID: string): string => {
  const args = getServer(workspaceID).args.map((arg) => `"${arg}"`);

  return `[mcp_servers.${SERVER_NAME}]\ncommand = "${SERVER_COMMAND}"\nargs = [${args.join(", ")}]\n`;
};
/** Adds the andesine section, replacing an earlier one. */
const withTOMLSection = (source: string, workspaceID: string): string => {
  const section = getTOMLSection(workspaceID);
  const header = `[mcp_servers.${SERVER_NAME}]`;
  const start = source.indexOf(header);

  if (start === -1) {
    const separator = source && !source.endsWith("\n") ? "\n\n" : source ? "\n" : "";

    return `${source}${separator}${section}`;
  }

  const next = source.slice(start + header.length).search(/^\[/m);
  const end = next === -1 ? source.length : start + header.length + next;

  return `${source.slice(0, start)}${section}${next === -1 ? "" : "\n"}${source.slice(end)}`;
};
const exists = async (file: string): Promise<boolean> => {
  return stat(file).then(
    () => true,
    () => false
  );
};
const parseJSON = (file: string, source: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(source);
    const object = Boolean(value) && typeof value === "object" && !Array.isArray(value);

    if (object) return value as Record<string, unknown>;
  } catch {
    // Reported below.
  }

  throw new CLIError(
    `${file} isn't a JSON object. Fix or remove it, then run init again.`,
    exitCodes.usage
  );
};
const withServer = (config: Record<string, unknown>, serversKey: string, workspaceID: string) => {
  const servers = (config[serversKey] ?? {}) as Record<string, unknown>;

  return { ...config, [serversKey]: { ...servers, [SERVER_NAME]: getServer(workspaceID) } };
};
const getStatus = async (directory: string, target: MCPClientConfig, workspaceID: string) => {
  const file = path.join(directory, target.file);
  const linked = await lstat(file).then(
    (info) => info.isSymbolicLink(),
    () => false
  );

  // Linked files are often shared (dotfiles), so they aren't changed.
  if (linked) return { file, source: undefined, status: "linked" as const };

  const source = await readProjectFile(file);

  if (source === undefined) return { file, source, status: "create" as const };

  if (target.format === "toml") {
    const unchanged = withTOMLSection(source, workspaceID) === source;

    return { file, source, status: unchanged ? ("unchanged" as const) : ("update" as const) };
  }

  const config = parseJSON(target.file, source);
  const unchanged =
    JSON.stringify(withServer(config, target.serversKey!, workspaceID)) === JSON.stringify(config);

  return { file, source, status: unchanged ? ("unchanged" as const) : ("update" as const) };
};

/** .mcp.json, and the files of the clients in use. */
const planMCPConfig = async (
  directory: string,
  workspaceID: string
): Promise<MCPConfigChange[]> => {
  const changes: MCPConfigChange[] = [];

  for (const target of MCP_CLIENTS) {
    const inUse = !target.directory || (await exists(path.join(directory, target.directory)));

    if (!inUse) continue;

    const { status } = await getStatus(directory, target, workspaceID);

    changes.push({ client: target.client, file: target.file, status });
  }

  return changes;
};
/** Keeps other servers and settings. */
const writeMCPConfig = async (
  directory: string,
  changes: MCPConfigChange[],
  workspaceID: string,
  signal: AbortSignal
): Promise<void> => {
  for (const change of changes) {
    const target = MCP_CLIENTS.find(({ file }) => file === change.file)!;
    const { file, source, status } = await getStatus(directory, target, workspaceID);

    if (status === "unchanged" || status === "linked") continue;

    if (target.format === "toml") {
      await writeProjectConfig(file, withTOMLSection(source ?? "", workspaceID), source, signal);
      continue;
    }

    const config = source === undefined ? {} : parseJSON(target.file, source);

    await writeProjectConfig(
      file,
      withServer(config, target.serversKey!, workspaceID),
      source,
      signal
    );
  }
};

const setUpMCP = async (
  context: CommandContext,
  directory: string,
  workspaceID: string,
  confirmChanges: boolean
): Promise<MCPConfigChange[]> => {
  const changes = await planMCPConfig(directory, workspaceID);
  const pending = changes.filter(({ status }) => status === "create" || status === "update");
  const fields = Object.fromEntries(
    changes.map(({ client, file, status }) => [file, `${client}: ${STATUS_LABELS[status]}`])
  );

  await context.output.note(
    pending.length ? "MCP server configuration" : "MCP server configuration unchanged",
    fields
  );

  if (!pending.length) return changes;

  if (confirmChanges) {
    const approved = await context.prompt((prompt) =>
      confirm({ ...prompt, message: "Save the MCP server configuration?", initialValue: true })
    );

    if (!approved) throw new CancelledError();
  }

  await context.output.progress(
    "Saving MCP server configuration",
    () => writeMCPConfig(directory, pending, workspaceID, context.signal),
    "MCP server configuration saved"
  );

  if (pending.some(({ file }) => file === ".codex/config.toml")) {
    await context.output.diagnostic(
      "Codex reads .codex/config.toml only after you trust this project."
    );
  }

  return changes;
};

export { setUpMCP };
