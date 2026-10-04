import { eventIterator } from "@orpc/contract";
import { type AIUsage, baseContract } from "./base";
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

const semanticSearchUsage: AIUsage = {
  kind: "semanticSearch",
  when: (input: { semantic: boolean }) => input.semantic
};
const searchContract = baseContract.prefix("/search").router({
  current: baseContract
    .route({
      summary: "Search current content",
      description:
        "Searches current entry content by text and optional property filters. Up to 20 filters and 50 results are allowed. Semantic search is optional, uses 1 AI credit, and has a separate rate limit.",
      tags: ["search"],
      method: "POST",
      path: "/current"
    })
    .meta({ example: { query: "installation", limit: 10 } })
    .meta({ required: { session: true, key: ["read:entries", "read:collections"] } })
    .meta({ aiUsage: semanticSearchUsage })
    .input(searchInputType)
    .output(searchResultType),
  published: baseContract
    .route({
      summary: "Search published content",
      description:
        "Searches content published to the required channel. Up to 20 filters and 50 results are allowed. Semantic search is optional, uses 1 AI credit, and has a separate rate limit.",
      tags: ["search"],
      method: "POST",
      path: "/published"
    })
    .meta({ example: { query: "installation", channel: "published", limit: 10 } })
    .meta({ publishable: true, required: { session: true, key: ["read:publishing"] } })
    .meta({ aiUsage: semanticSearchUsage })
    .input(publishedSearchInputType)
    .output(publishedSearchResultType),
  askCurrent: baseContract
    .route({
      summary: "Ask AI about current content",
      description:
        "Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses 3 AI credits and the Ask AI rate limit. Use a secret key on your server, or a publishable key for published content.",
      tags: ["search"],
      method: "POST",
      path: "/current/ask"
    })
    .meta({
      required: { session: true, key: ["ai-answers", "read:entries", "read:collections"] },
      aiUsage: { kind: "answer" },
      example: { question: "How do I install Andesine?" }
    })
    .input(askInputType)
    .output(askResultType),
  askPublished: baseContract
    .route({
      summary: "Ask AI about published content",
      description:
        "Returns a complete answer with numbered sources. Requires explicit ai-answers permission in addition to content read permissions. Accepts up to 1,000 question characters, 10 history messages of up to 4,000 characters each, and 20 property filters. Uses 3 AI credits and the Ask AI rate limit. Use a secret key on your server, or a publishable key for published content.",
      tags: ["search"],
      method: "POST",
      path: "/published/ask"
    })
    .meta({
      publishable: true,
      required: { session: true, key: ["ai-answers", "read:publishing"] },
      aiUsage: { kind: "answer" },
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
        "Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, AI credits, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically."
    })
    .meta({
      required: { session: true, key: ["ai-answers", "read:entries", "read:collections"] },
      aiUsage: { kind: "answer" },
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
        "Emits sources, textDelta, and completed events over SSE. Uses the same inputs, permissions, AI credits, and rate limit as complete answers. Stream errors use SSE error frames. Never reconnect automatically."
    })
    .meta({
      publishable: true,
      required: { session: true, key: ["ai-answers", "read:publishing"] },
      aiUsage: { kind: "answer" },
      usageTiming: "generation"
    })
    .input(publishedAskInputType)
    .output(eventIterator(publishedAnswerEventType))
});

export { searchContract };
