import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { AndesineAPIError, createClient } from "@andesine/sdk";
import { createMCPServer, type CheckpointStore } from "@andesine/mcp";
import { redis } from "#backend/lib/adapters";
import { createHash, randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toUUID } from "@andesine/contracts/primitives";
import { getMCPResource, MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "#backend/lib/auth/oauth";

interface MCPRouteOptions {
  /** Public URL of this API: the MCP resources and the authorization server. */
  publicURL: string;
  /** Token for the OpenAI plugin directory's domain check, set while a submission is verified. */
  openAIChallenge?: string;
  /** Glama ownership claim token (glama_claim_...), served while the listing is claimed. */
  glamaClaim?: string;
}
interface MCPRouteParams {
  workspaceID?: string;
}

const CHECKPOINT_TTL_SECONDS = 60 * 60;
const MCP_REQUEST_HEADER = "x-andesine-mcp-request";
// Only in-process requests know it, so external clients can't mark requests as MCP ones.
const MCP_REQUEST_SECRET = randomUUID();

// Requests share no session, so checkpoints are per principal (tokens rotate) and entry, for an hour.
const createCheckpointStore = (workspaceID: string, principal: string): CheckpointStore => {
  const principalHash = createHash("sha256").update(principal).digest("hex");

  return {
    claim: async (entryID) => {
      const key = `mcp-checkpoint:${workspaceID}:${principalHash}:${entryID}`;

      return (await redis.set(key, "1", { NX: true, EX: CHECKPOINT_TTL_SECONDS })) !== null;
    }
  };
};
// Tools call this API in the process, so HTTPS and the listen address don't matter.
const createInjectFetch = (app: FastifyInstance, publicURL: string): typeof fetch => {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.body ? Buffer.from(await request.arrayBuffer()) : undefined;
    const response = await app.inject({
      method: request.method as "GET",
      url: `${url.pathname}${url.search}`,
      headers: {
        ...Object.fromEntries(request.headers),
        host: new URL(publicURL).host,
        [MCP_REQUEST_HEADER]: MCP_REQUEST_SECRET
      },
      ...(body && { payload: body })
    });
    const headers = new Headers();
    const hasBody = ![204, 205, 304].includes(response.statusCode);

    for (const [name, value] of Object.entries(response.headers)) {
      for (const item of [value ?? []].flat()) headers.append(name, String(item));
    }

    return new Response(hasBody ? new Uint8Array(response.rawPayload) : null, {
      status: response.statusCode,
      headers
    });
  };
};
const sendError = (reply: FastifyReply, status: number, message: string) => {
  return reply.status(status).send({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
};
const getResourceMetadataURL = (publicURL: string, workspaceID?: string): string => {
  return `${publicURL}/.well-known/oauth-protected-resource/mcp${workspaceID ? `/${workspaceID}` : ""}`;
};
const isMCPRequest = (headers?: Headers): boolean => {
  return headers?.get(MCP_REQUEST_HEADER) === MCP_REQUEST_SECRET;
};
const isSameWorkspace = (first: string, second: string): boolean => {
  try {
    return toUUID(first) === toUUID(second);
  } catch {
    return false;
  }
};

/** Stateless MCP at /mcp and /mcp/{workspaceID}; tools call the public API as the caller. */
const mcpPlugin: FastifyPluginAsync<MCPRouteOptions> = async (app, options) => {
  const injectFetch = createInjectFetch(app, options.publicURL);
  const handlePost = async (
    request: FastifyRequest<{ Params: MCPRouteParams }>,
    reply: FastifyReply
  ) => {
    const token = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? "")?.[1];

    let workspaceID = request.params.workspaceID;

    // The challenge leads OAuth clients to the resource metadata and the authorization server.
    const challenge = () => {
      const metadataURL = getResourceMetadataURL(options.publicURL, workspaceID);

      return reply.header(
        "WWW-Authenticate",
        `Bearer resource_metadata="${metadataURL}", scope="${MCP_READ_SCOPE} ${MCP_WRITE_SCOPE}"`
      );
    };

    if (!token) return sendError(challenge(), 401, "Sign in with OAuth or use an API key");

    const createAPIClient = (headers?: Record<string, string>) => {
      return createClient({
        baseURL: options.publicURL,
        fetch: injectFetch,
        apiKey: token,
        headers
      });
    };

    let identity: Awaited<ReturnType<ReturnType<typeof createAPIClient>["auth"]["getIdentity"]>>;

    try {
      identity = await createAPIClient().auth.getIdentity({});
      const otherWorkspace =
        workspaceID !== undefined &&
        identity.workspaceID !== undefined &&
        !isSameWorkspace(identity.workspaceID, workspaceID);

      if (otherWorkspace) return sendError(reply, 403, "The credential is for another workspace");

      workspaceID ??= identity.workspaceID;

      if (!workspaceID) {
        return sendError(reply, 400, "This credential has no workspace; use /mcp/{workspaceID}");
      }
    } catch (error) {
      const status = error instanceof AndesineAPIError ? error.status : 500;
      const message = error instanceof Error ? error.message : "Unauthorized";

      return sendError(status === 401 ? challenge() : reply, status, message);
    }

    const server = await createMCPServer({
      client: createAPIClient({ "x-workspace-id": workspaceID }),
      workspaceID,
      identity,
      checkpoints: createCheckpointStore(
        workspaceID,
        identity.type === "key"
          ? `key:${identity.keyID}`
          : `${identity.client?.id ?? identity.type}:${identity.user.id}`
      )
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    // Headers set on the reply (for example CORS) aren't sent after a hijack, so copy them.
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value);
    }

    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  };

  app.post<{ Params: MCPRouteParams }>("/mcp", handlePost);
  app.post<{ Params: MCPRouteParams }>("/mcp/:workspaceID", handlePost);
  // Protected resource metadata (RFC 9728) for the fixed MCP URL and each workspace's URL.
  app.get<{ Params: MCPRouteParams }>(
    "/.well-known/oauth-protected-resource/mcp/:workspaceID?",
    (request, reply) => {
      const { workspaceID } = request.params;

      return reply.send({
        resource: getMCPResource(options.publicURL, workspaceID),
        resource_name: "Andesine",
        authorization_servers: [`${options.publicURL}/auth`],
        scopes_supported: [MCP_READ_SCOPE, MCP_WRITE_SCOPE],
        bearer_methods_supported: ["header"]
      });
    }
  );
  app.get("/.well-known/openai-apps-challenge", (_request, reply) => {
    if (!options.openAIChallenge) return reply.status(404).send();

    return reply.type("text/plain").send(options.openAIChallenge);
  });
  app.get("/.well-known/glama.json", (_request, reply) => {
    if (!options.glamaClaim) return reply.status(404).send();

    return reply.send({
      $schema: "https://glama.ai/mcp/schemas/connector.json",
      claim: options.glamaClaim
    });
  });
  // Stateless: no server-sent event streams or sessions to end.
  app.route({
    method: ["GET", "DELETE"],
    url: "/mcp/:workspaceID?",
    handler: (_request, reply) => sendError(reply.header("Allow", "POST"), 405, "Use POST")
  });
};

export { isMCPRequest, mcpPlugin };
