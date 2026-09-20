import { commonErrors } from "#backend/contracts/errors";
import { validateORPCError } from "@orpc/contract";
import { withErrorHints } from "#backend/lib/transport/error";
import { generateOpenAPI } from "#backend/contracts/openapi";
import { config } from "#backend/lib/config";
import { consumeRateLimit, RATE_LIMITS } from "#backend/lib/security";
import { Auth } from "#backend/services/auth";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { onError, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fastify";
import { RequestHeadersPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";
import { experimental_ZodSmartCoercionPlugin } from "@orpc/zod/zod4";
import { type FastifyPluginAsync, type FastifyReply, type FastifyRequest } from "fastify";
import { router } from "./routes";
import { apiContract } from "./implement";

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
    plugins: [
      new RequestHeadersPlugin(),
      new ResponseHeadersPlugin(),
      new experimental_ZodSmartCoercionPlugin()
    ],
    interceptors: [
      onError((error, options) => {
        logORPCError(error, options);
        throw withErrorHints(error);
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
  const openAPIDocument = await generateOpenAPI(apiContract, config.PUBLIC_API_URL);

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
          data: {
            retryAfterSeconds: limit.retryAfter,
            hints: ["Wait at least retryAfterSeconds before trying again."]
          },
          message: "Too many image uploads; try again shortly"
        });
      }
    } catch (error) {
      if (!(error instanceof ORPCError)) throw error;

      const apiError = await validateORPCError(commonErrors, withErrorHints(error) as typeof error);

      return reply.status(apiError.status).send(apiError.toJSON());
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
