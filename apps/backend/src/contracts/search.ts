import { eventIterator } from "@orpc/contract";
import { baseContract } from "./base";
import {
  answerEventType,
  publishedAnswerEventType,
  publishedSearchResultType,
  publishedAskResultType,
  askInputType,
  askResultType,
  publishedAskInputType,
  publishedSearchInputType,
  searchInputType,
  searchResultType
} from "./schemas/search";

const searchContract = baseContract.prefix("/search").router({
  current: baseContract
    .route({
      summary: "Search current content",
      description:
        "Searches current entry content by text and optional property filters. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.",
      tags: ["search"],
      method: "POST",
      path: "/current"
    })
    .meta({ example: { query: "installation", limit: 10 } })
    .meta({ required: { session: true, key: ["read:entries", "read:collections"] } })
    .input(searchInputType)
    .output(searchResultType),
  published: baseContract
    .route({
      summary: "Search published content",
      description:
        "Searches content published to the required channel. Up to 20 filters and 50 results are allowed. Semantic search is optional and has a separate rate limit.",
      tags: ["search"],
      method: "POST",
      path: "/published"
    })
    .meta({ example: { query: "installation", channel: "published", limit: 10 } })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(publishedSearchInputType)
    .output(publishedSearchResultType),
  askCurrent: baseContract
    .route({
      summary: "Ask AI about current content",
      description:
        "Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.",
      tags: ["search"],
      method: "POST",
      path: "/current/ask"
    })
    .meta({
      required: { session: true, key: ["ai-answers", "read:entries", "read:collections"] },
      trackUsage: true,
      example: { question: "How do I install Andesine?" }
    })
    .input(askInputType)
    .output(askResultType),
  askPublished: baseContract
    .route({
      summary: "Ask AI about published content",
      description:
        "Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses the existing Ask AI rate limit. Keep API keys on your server.",
      tags: ["search"],
      method: "POST",
      path: "/published/ask"
    })
    .meta({
      required: { session: true, key: ["ai-answers", "read:publishing"] },
      trackUsage: true,
      example: { question: "How do I install Andesine?", channel: "published" }
    })
    .input(publishedAskInputType)
    .output(publishedAskResultType),
  askCurrentStream: baseContract
    .route({
      method: "POST",
      path: "/current/ask/stream",
      tags: ["search"],
      summary: "Stream an AI answer about current content",
      description:
        "Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically."
    })
    .meta({
      required: { session: true, key: ["ai-answers", "read:entries", "read:collections"] },
      trackUsage: true,
      usageTiming: "generation"
    })
    .input(askInputType)
    .output(eventIterator(answerEventType)),
  askPublishedStream: baseContract
    .route({
      method: "POST",
      path: "/published/ask/stream",
      tags: ["search"],
      summary: "Stream an AI answer about published content",
      description:
        "Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically."
    })
    .meta({
      required: { session: true, key: ["ai-answers", "read:publishing"] },
      trackUsage: true,
      usageTiming: "generation"
    })
    .input(publishedAskInputType)
    .output(eventIterator(publishedAnswerEventType))
});

export { searchContract };
