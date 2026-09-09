import { billingRouter } from "./billing";
import { assetsRouter } from "./assets";
import { collectionsRouter } from "./collections";
import { contentRouter } from "./content";
import { entriesRouter } from "./entries";
import { groupsRouter } from "./groups";
import { syncRouter } from "./sync";
import { keysRouter } from "./keys";
import { rolesRouter } from "./roles";
import { schemasRouter } from "./schemas";
import { schemaMigrationsRouter } from "./schema-migrations";
import { schemaVersionsRouter } from "./schema-versions";
import { searchRouter } from "./search";
import { membershipsRouter } from "./memberships";
import { publishingRouter } from "./publishing";
import { workspacesRouter } from "./workspaces";
import { versionsRouter } from "./versions";
import { authRouter } from "./auth";
import { type FastifyPluginAsync, type FastifyReply, type FastifyRequest } from "fastify";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { RequestHeadersPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";
import { onError, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fastify";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RATE_LIMITS, consumeRateLimit } from "#backend/lib/security";
import { config } from "#backend/lib/config";
import { Auth } from "#backend/services/auth";

const router = {
  assets: assetsRouter,
  auth: authRouter,
  entries: entriesRouter,
  groups: groupsRouter,
  collections: collectionsRouter,
  content: contentRouter,
  billing: billingRouter,
  keys: keysRouter,
  roles: rolesRouter,
  search: searchRouter,
  schemas: schemasRouter,
  schemaMigrations: schemaMigrationsRouter,
  schemaVersions: schemaVersionsRouter,
  memberships: membershipsRouter,
  publishing: publishingRouter,
  workspaces: workspacesRouter,
  versions: versionsRouter,
  sync: syncRouter
};
const routerPlugin: FastifyPluginAsync = async (app) => {
  const method = ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"];
  const limitInviteAcceptance = async (req: FastifyRequest, reply: FastifyReply) => {
    const pathname = req.url.split("?")[0];

    if (pathname !== "/memberships/accept" && pathname !== "/rpc/memberships/acceptInvite") {
      return;
    }

    const limit = await consumeRateLimit({
      scope: "invite-acceptance",
      key: req.ip,
      limit: RATE_LIMITS.inviteAcceptance
    });

    if (!limit.allowed) {
      return reply
        .status(429)
        .header("Retry-After", limit.retryAfter)
        .send({ error: "Too many invite attempts. Please try again later." });
    }
  };
  const logORPCError = (error: unknown, options?: unknown) => {
    if (error instanceof ORPCError) {
      const cause = (error as { cause?: unknown }).cause;

      console.error(error.message, {
        code: error.code,
        cause,
        options
      });
      return;
    }

    console.error(error, { options });
  };
  const openAPIHandler = new OpenAPIHandler(router, {
    plugins: [new RequestHeadersPlugin(), new ResponseHeadersPlugin()],
    interceptors: [
      onError((error, options) => {
        logORPCError(error, options);
      })
    ]
  });
  const rpcHandler = new RPCHandler(router, {
    plugins: [new RequestHeadersPlugin(), new ResponseHeadersPlugin()],
    interceptors: [
      onError((error, options) => {
        logORPCError(error, options);
      })
    ]
  });
  const openAPIDocument = await new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(router, {
    filter: ({ contract }) => Boolean(contract["~orpc"].meta.required?.key),
    info: {
      title: "Andesine API",
      version: "1.0.0"
    },
    servers: [{ url: config.PUBLIC_API_URL }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Andesine API key",
          description: "Use an Andesine API key as a Bearer token"
        }
      }
    }
  });

  app.removeAllContentTypeParsers();
  // Authenticate multipart requests before Fastify buffers files. ORPC checks entry access later.
  app.addHook("onRequest", async (request, reply) => {
    const contentType = request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
    const headers = new Headers();

    if (contentType !== "multipart/form-data") return;

    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined) {
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
    }
    reply.header("Cache-Control", "private, no-store");

    try {
      const auth = await Auth.getSessionData({ headers });
      const limit = await consumeRateLimit({
        scope: "asset-upload",
        key: auth.workspaceID,
        limit: { max: 30, window: 60 }
      });

      if (!limit.allowed) {
        reply.header("Retry-After", limit.retryAfter);

        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "Too many image uploads; try again shortly"
        });
      }
    } catch (error) {
      if (!(error instanceof ORPCError)) throw error;

      return reply.status(error.status).send({ code: error.code, message: error.message });
    }
  });
  app.addContentTypeParser(
    "multipart/form-data",
    // Allow multipart headers and fields in addition to the file's separate schema limit.
    { parseAs: "buffer", bodyLimit: config.ASSET_MAX_UPLOAD_BYTES + 64 * 1024 },
    async (request: FastifyRequest, body: Buffer) => {
      const response = new Response(new Uint8Array(body), {
        headers: { "Content-Type": request.headers["content-type"]! }
      });

      try {
        return await response.formData();
      } catch {
        throw Object.assign(new Error("Invalid multipart body"), { statusCode: 400 });
      }
    }
  );
  app.addContentTypeParser("*", function (_request, _payload, done) {
    done(null, undefined);
  });
  app.get("/openapi.json", async (_request, reply) => {
    return reply.send(openAPIDocument);
  });
  app.route({
    url: "/rpc/*",
    method,
    preHandler: limitInviteAcceptance,
    handler: async (req, reply) => {
      const { matched } = await rpcHandler.handle(req, reply, {
        prefix: "/rpc",
        context: {} // Provide initial context if needed
      });

      if (!matched) {
        reply.status(404).send("Not found");
      }
    }
  });
  app.route({
    url: "/*",
    method,
    preHandler: limitInviteAcceptance,
    handler: async (req, reply) => {
      const { matched } = await openAPIHandler.handle(req, reply, {
        prefix: "/",
        context: {} // Provide initial context if needed
      });

      if (!matched) {
        reply.status(404).send("Not found");
      }
    }
  });
};

export { router, routerPlugin };
