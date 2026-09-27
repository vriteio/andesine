import type { PublishedAnswerEvent, PublishedAnswerSource } from "@andesine/sdk";
import { z } from "zod";
import type { PagesConfig } from "../config";
import { createRateLimit } from "./rate-limit";
import {
  createPageResolver,
  json,
  readRequest,
  toAnchorHash,
  toErrorResponse,
  type PageResolver
} from "./request";
import type { AnswerEvent, AnswerSource } from "./types";

/** The API limits for questions and history. */
const bodySchema = z
  .object({
    source: z.string().min(1),
    question: z.string().trim().min(1).max(1000),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(4000)
          })
          .strict()
      )
      .max(10)
      .default([])
  })
  .strict();
const encoder = new TextEncoder();
// Each client can ask 10 questions a minute.
const allowQuestion = createRateLimit({ limit: 10, window: 60_000 });

const toSources = (sources: PublishedAnswerSource[], resolve: PageResolver): AnswerSource[] => {
  return sources.flatMap((source) => {
    const href = resolve(source);

    return href
      ? [
          {
            id: source.id,
            href: `${href}${toAnchorHash(source.anchor)}`,
            title: source.title,
            headingPath: source.headingPath,
            collectionPath: source.collectionPath
          }
        ]
      : [];
  });
};
const encode = (event: AnswerEvent): Uint8Array => encoder.encode(`${JSON.stringify(event)}\n`);
/**
 * Streams an AI answer about the published collection of an Andesine source, as one JSON
 * event per line. Cited pages are mapped to page URLs; pages without one are left out.
 */
const handleAnswer = async (
  request: Request,
  config: PagesConfig,
  clientAddress?: string
): Promise<Response> => {
  if (clientAddress && !allowQuestion(clientAddress)) {
    return json({ error: "Too many questions. Try again soon." }, 429, { "Retry-After": "60" });
  }

  const result = await readRequest(request, config, {
    schema: bodySchema,
    maxSize: 64_000,
    timeout: 120_000
  });

  if ("response" in result) return result.response;

  const { body, source, client, signal } = result.request;

  if (!source.answers) return json({ error: "AI answers are off for this source." }, 403);

  let resolve: PageResolver;
  let events: AsyncIterable<PublishedAnswerEvent>;

  try {
    [resolve, events] = await Promise.all([
      createPageResolver(source, config.base, client),
      client.search.askPublishedStream(
        {
          question: body.question,
          history: body.history,
          collectionID: source.collection,
          channel: "published"
        },
        { signal }
      )
    ]);
  } catch (error) {
    return toErrorResponse(error, {
      limited: "Too many questions. Try again soon.",
      failed: "AI answers are not available now."
    });
  }

  const iterator = events[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const next = await iterator.next();

          if (next.done) {
            controller.close();

            return;
          }

          const event = next.value;

          if (event.type === "textDelta") {
            controller.enqueue(encode(event));
          } else if (event.type === "sources") {
            controller.enqueue(
              encode({ type: "sources", sources: toSources(event.sources, resolve) })
            );
          } else {
            controller.enqueue(
              encode({
                type: "completed",
                answer: event.answer,
                sources: toSources(event.sources, resolve)
              })
            );
          }
        } catch (error) {
          if (!signal.aborted) console.error(error);

          controller.enqueue(
            encode({ type: "error", error: "The answer could not be completed." })
          );
          controller.close();
          await iterator.return?.();
        }
      },
      async cancel() {
        await iterator.return?.();
      }
    },
    { highWaterMark: 0 }
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
};

export { handleAnswer };
