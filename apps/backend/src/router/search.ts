import { RATE_LIMITS, consumeRateLimit } from "#backend/lib/security";
import { authorized } from "#backend/lib/transport";
import { Search } from "#backend/services/search";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";
const enforceAskRateLimit = async (key: string, headers?: Headers): Promise<void> => {
  const limit = await consumeRateLimit({
    scope: "ask-ai",
    key,
    limit: RATE_LIMITS.askAI
  });

  if (limit.allowed) return;

  headers?.set("Retry-After", `${limit.retryAfter}`);
  throw new ORPCError("TOO_MANY_REQUESTS", {
    data: {
      retryAfterSeconds: limit.retryAfter,
      hints: ["Wait at least retryAfterSeconds before trying again."]
    },
    message: "Too many Ask AI requests. Try again later."
  });
};
const enforceSemanticSearchRateLimit = async (key: string, headers?: Headers): Promise<void> => {
  const limit = await consumeRateLimit({
    scope: "semantic-search",
    key,
    limit: RATE_LIMITS.semanticSearch
  });

  if (limit.allowed) return;

  headers?.set("Retry-After", `${limit.retryAfter}`);
  throw new ORPCError("TOO_MANY_REQUESTS", {
    data: {
      retryAfterSeconds: limit.retryAfter,
      hints: ["Wait at least retryAfterSeconds before trying again."]
    },
    message: "Too many semantic search requests. Try again later."
  });
};
const handlers = api.search;
const authorizedHandlers = handlers.use(authorized);
const searchRouter = handlers.router({
  current: authorizedHandlers.current.handler(async ({ context, input }) => {
    if (input.semantic) {
      await enforceSemanticSearchRateLimit(context.auth.id, context.resHeaders);
    }

    return Search.current({ auth: context.auth, ...input });
  }),
  published: authorizedHandlers.published.handler(async ({ context, input }) => {
    if (input.semantic) {
      await enforceSemanticSearchRateLimit(context.auth.id, context.resHeaders);
    }

    return Search.published({ auth: context.auth, ...input });
  }),
  askCurrent: authorizedHandlers.askCurrent.handler(async ({ context, input }) => {
    await enforceAskRateLimit(context.auth.id, context.resHeaders);

    return Search.askCurrent({ auth: context.auth, ...input });
  }),
  askPublished: authorizedHandlers.askPublished.handler(async ({ context, input }) => {
    await enforceAskRateLimit(context.auth.id, context.resHeaders);

    return Search.askPublished({ auth: context.auth, ...input });
  }),
  askCurrentStream: authorizedHandlers.askCurrentStream.handler(
    async ({ context, input, signal }) => {
      await enforceAskRateLimit(context.auth.id, context.resHeaders);
      context.resHeaders?.set("Cache-Control", "private, no-store, no-transform");
      context.resHeaders?.set("X-Accel-Buffering", "no");
      return Search.askCurrentStream(
        { auth: context.auth, ...input, signal },
        { onStart: context.recordRequestUsage }
      );
    }
  ),
  askPublishedStream: authorizedHandlers.askPublishedStream.handler(
    async ({ context, input, signal }) => {
      await enforceAskRateLimit(context.auth.id, context.resHeaders);
      context.resHeaders?.set("Cache-Control", "private, no-store, no-transform");
      context.resHeaders?.set("X-Accel-Buffering", "no");
      return Search.askPublishedStream(
        { auth: context.auth, ...input, signal },
        { onStart: context.recordRequestUsage }
      );
    }
  )
});

export { searchRouter };
