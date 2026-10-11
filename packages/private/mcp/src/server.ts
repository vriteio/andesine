import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createMemoryCheckpointStore,
  type AndesineClient,
  type CheckpointStore,
  type ToolContext
} from "./context";
import { publishTools } from "./tools/publish";
import { readTools } from "./tools/read";
import { writeTools } from "./tools/write";
import { createUploadTool, type ReadLocalFile } from "./tools/upload";
import { resources, type ResourceName } from "./resources";
import { prompts, type PromptName } from "./prompts";

interface CreateMCPServerOptions {
  client: AndesineClient;
  /** Read by the caller already. */
  identity?: Identity;
  /** Workspace of the session; API keys use their own workspace. */
  workspaceID?: string;
  /** Lists only the tools that read content. */
  readOnly?: boolean;
  /** Where checkpoints are recorded; stateless servers need a shared store. Default: memory. */
  checkpoints?: CheckpointStore;
  /** Reads local files for upload_image; only servers on the user's machine provide it. */
  readLocalFile?: ReadLocalFile;
  version?: string;
}

type Identity = Awaited<ReturnType<AndesineClient["auth"]["getIdentity"]>>;
type ToolName =
  keyof typeof readTools | keyof typeof writeTools | keyof typeof publishTools | "upload_image";

// Write permissions also grant reads of the same resource; any listed permission is enough.
const TOOL_PERMISSIONS: Record<ToolName, string[]> = {
  search: ["read:entries"],
  fetch: ["read:entries"],
  get_tree: ["read:collections"],
  get_schema: ["read:collections"],
  list_versions: ["read:versions"],
  list_channels: ["read:publishing"],
  create_entry: ["entries"],
  edit_entry: ["entries"],
  write_entry: ["entries"],
  move: ["entries", "collections"],
  delete: ["entries", "collections"],
  save_version: ["versions"],
  revert_version: ["versions"],
  publish: ["publishing"],
  unpublish: ["publishing"],
  upload_image: ["entries"]
};
const RESOURCE_PERMISSIONS: Record<ResourceName, string[]> = {
  workspace: ["read:collections"],
  entries: ["read:entries"],
  published: ["read:publishing"],
  schema: ["read:collections"],
  guide: []
};
// Prompts that change content are listed only with write tools.
const PROMPT_PERMISSIONS: Record<PromptName, { permissions: string[]; writes: boolean }> = {
  "draft-entry": { permissions: ["entries"], writes: true },
  "update-docs": { permissions: ["entries"], writes: true },
  "review-entry": { permissions: ["read:entries"], writes: false },
  "answer": { permissions: ["read:entries"], writes: false },
  "release-notes": { permissions: ["read:publishing"], writes: false },
  "reorganize": { permissions: ["entries", "collections"], writes: true }
};
const INSTRUCTIONS = `Andesine is a knowledge base, CMS, and docs platform. A workspace has a tree of collections that hold entries; an entry is a document with a title, optional schema fields (properties and fragments), and content. People edit entries live; publishing copies versions to channels (published by default) that sites read.

Content is MDX: the title is the H1; properties are <Property name="..." value={...} /> elements; fragments are <Fragment name="...">...</Fragment>; images are ![alt](asset:ast_...); links to entries are [text](entry:/collection/entry). In text, escape < and { with a backslash; comments aren't supported.

Address entries by ID (ent_...) or path (/Collection/Entry). Find content with search or get_tree, and read it with fetch. Change existing content with edit_entry operations (block IDs from fetch with format blocks); use write_entry only for full rewrites. Images by URL in edit_entry and write_entry are imported. When a call fails, read the error and its hints, read the entry again, and retry. The andesine://guide/mdx resource has the full MDX syntax.`;

const TOOL_GROUPS = [
  { tools: readTools, writes: false },
  { tools: writeTools, writes: true },
  { tools: publishTools, writes: true }
];

const isAllowed = (required: string[], permissions?: string[]): boolean => {
  if (!permissions || !required.length) return true;

  return required.some((permission) => {
    return (
      permissions.includes(permission) || permissions.includes(permission.replace("read:", ""))
    );
  });
};

/**
 * Creates an MCP server with Andesine tools over the public API client. The API checks every
 * call; for API keys, tools that the key's permissions don't allow aren't listed.
 */
const createMCPServer = async (options: CreateMCPServerOptions): Promise<McpServer> => {
  const { client } = options;
  const [identity, instance] = await Promise.all([
    options.identity ?? client.auth.getIdentity({}),
    client.instance.get({})
  ]);
  const permissions = identity.type === "key" ? identity.permissions : undefined;
  const scopes = identity.type === "key" ? undefined : identity.scopes;
  const readOnly =
    options.readOnly ||
    (scopes?.includes("andesine:read") === true && !scopes.includes("andesine:write"));
  const server = new McpServer(
    { name: "andesine", title: "Andesine", version: options.version ?? "0.0.0" },
    { instructions: INSTRUCTIONS }
  );
  const context: ToolContext = {
    client,
    appURL: instance.appURL,
    workspaceID: identity.workspaceID ?? options.workspaceID,
    semanticSearch: instance.features.semanticSearch,
    // Stateless HTTP requests after initialization carry no client info; use the OAuth client's.
    clientName: () => {
      const oauthClient = identity.type === "key" ? undefined : identity.client?.name;

      return server.server.getClientVersion()?.name ?? oauthClient ?? "an agent";
    },
    checkpoints: options.checkpoints ?? createMemoryCheckpointStore()
  };

  for (const { tools, writes } of TOOL_GROUPS) {
    for (const [name, register] of Object.entries(tools)) {
      const hidden =
        (readOnly && writes) || !isAllowed(TOOL_PERMISSIONS[name as ToolName], permissions);

      if (!hidden) register(server, context);
    }
  }

  const { readLocalFile } = options;
  const uploadAllowed = !readOnly && isAllowed(TOOL_PERMISSIONS.upload_image, permissions);

  if (readLocalFile && uploadAllowed) createUploadTool(readLocalFile)(server, context);

  for (const [name, register] of Object.entries(resources)) {
    if (isAllowed(RESOURCE_PERMISSIONS[name as ResourceName], permissions)) {
      register(server, context);
    }
  }

  for (const [name, register] of Object.entries(prompts)) {
    const prompt = PROMPT_PERMISSIONS[name as PromptName];
    const listed = (!readOnly || !prompt.writes) && isAllowed(prompt.permissions, permissions);

    if (listed) {
      register(server, context);
    }
  }

  return server;
};

export { createMCPServer };
export type { CreateMCPServerOptions };
