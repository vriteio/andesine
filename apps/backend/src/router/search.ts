import { authorized } from "#backend/lib/transport";
import { Search } from "#backend/services/search";
import { api } from "./implement";
import { trackEvent } from "#backend/lib/analytics";

const handlers = api.search;
const authorizedHandlers = handlers.use(authorized);
const searchRouter = handlers.router({
  current: authorizedHandlers.current.handler(async ({ context, input }) => {
    // The web app sends this once per opened result, not per typed query.
    if (context.auth.type !== "session") {
      trackEvent("search_used", context.auth, { trigger: "request" });
    }

    return Search.current({ auth: context.auth, ...input });
  }),
  published: authorizedHandlers.published.handler(async ({ context, input }) => {
    return Search.published({ auth: context.auth, ...input });
  }),
  askCurrent: authorizedHandlers.askCurrent.handler(async ({ context, input }) => {
    trackEvent("ask_used", context.auth);

    return Search.askCurrent({ auth: context.auth, ...input });
  }),
  askPublished: authorizedHandlers.askPublished.handler(async ({ context, input }) => {
    return Search.askPublished({ auth: context.auth, ...input });
  }),
  askCurrentStream: authorizedHandlers.askCurrentStream.handler(
    async ({ context, input, signal }) => {
      trackEvent("ask_used", context.auth);

      return Search.askCurrentStream(
        { auth: context.auth, ...input, signal },
        { onStart: context.recordRequestUsage }
      );
    }
  ),
  askPublishedStream: authorizedHandlers.askPublishedStream.handler(
    async ({ context, input, signal }) => {
      return Search.askPublishedStream(
        { auth: context.auth, ...input, signal },
        { onStart: context.recordRequestUsage }
      );
    }
  )
});

export { searchRouter };
