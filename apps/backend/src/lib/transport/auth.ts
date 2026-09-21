import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

interface AuthRouteOptions {
  baseURL: string;
  handler: (request: Request) => Promise<Response>;
}

/** Forward JSON and OAuth form requests to Better Auth without losing repeated form fields. */
const authPlugin: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
  const handleRequest = async (request: FastifyRequest, reply: FastifyReply) => {
    const headers = new Headers(request.headers as HeadersInit);
    const hasBody = !["GET", "HEAD"].includes(request.method) && request.body !== undefined;
    const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);

    headers.set("x-client-ip", request.ip);

    try {
      const response = await options.handler(
        new Request(new URL(request.url, options.baseURL), {
          method: request.method,
          headers,
          ...(hasBody && { body })
        })
      );

      reply.status(response.status);

      for (const [name, value] of response.headers) {
        if (name !== "set-cookie") reply.header(name, value);
      }

      const cookies = response.headers.getSetCookie();

      if (cookies.length) reply.header("set-cookie", cookies);

      return reply.send(response.body);
    } catch (error) {
      app.log.error({ err: error }, "Authentication request failed");
      return reply
        .status(500)
        .send({ error: "Internal authentication error", code: "AUTH_FAILURE" });
    }
  };

  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, body);
    }
  );
  app.route({ method: ["GET", "POST"], url: "/auth/*", handler: handleRequest });
  app.get("/.well-known/oauth-authorization-server/auth", handleRequest);
};

export { authPlugin };
