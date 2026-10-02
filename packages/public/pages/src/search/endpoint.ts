import { z } from "zod";
import type { PagesConfig } from "../config";
import { toSearchItems } from "./items";
import { createPageResolver, json, readRequest, toErrorResponse } from "./request";

const bodySchema = z
  .object({
    source: z.string().min(1),
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(20).default(8)
  })
  .strict();

const handleSearch = async (request: Request, config: PagesConfig): Promise<Response> => {
  const result = await readRequest(request, config, {
    schema: bodySchema,
    maxSize: 4_000,
    timeout: 15_000
  });

  if ("response" in result) return result.response;

  const { body, source, client, signal } = result.request;

  try {
    const [resolve, { results }] = await Promise.all([
      createPageResolver(source, config.base),
      client.search.published(
        {
          query: body.query,
          collectionID: source.collection,
          channel: "published",
          limit: body.limit
        },
        { signal }
      )
    ]);
    const items = toSearchItems(results, resolve);

    return json({ items });
  } catch (error) {
    return toErrorResponse(error, {
      limited: "Too many searches. Try again soon.",
      failed: "Search is not available now."
    });
  }
};

export { handleSearch };
