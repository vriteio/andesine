import { encodeEventMessage } from "@orpc/standard-server";
import type { AnswerEvent } from "./generated/schema";
import { AndesineAPIError } from "./error";
import { createAnswerStream } from "./answer-stream";

/**
 * Read typed answer events from an Andesine SSE response or a forwarded toAnswerResponse().
 *
 * @param response - An unconsumed Fetch response. Its body must use Andesine/oRPC SSE framing.
 * @param options - Optional cancellation signal. Breaking iteration also closes the reader.
 * @returns An iterator of sources, textDelta, and completed events; no automatic reconnection.
 * Consume or close the iterator to release the response body.
 * @throws AndesineAPIError for HTTP errors, AndesineStreamError for API error frames, or
 * AndesineStreamProtocolError for invalid/incomplete streams. Abort reasons are preserved.
 */
const readAnswerStream = async (response: Response, options: { signal?: AbortSignal } = {}) => {
  if (!response.ok) {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* Keep non-JSON error responses. */
    }
    throw new AndesineAPIError(response, body);
  }
  return createAnswerStream(response, options);
};

/**
 * Forward answer events as a Fetch Response from your server to a browser.
 *
 * @param events - The iterator returned by an answer stream method, or equivalent typed events.
 * @returns An SSE response with caching and proxy buffering disabled. It preserves backpressure
 * and cancellation without copying upstream credentials or headers. API errors become typed
 * error frames; other failures become generic error frames. A completed event is required.
 * Handle errors that occur while opening the upstream stream in your route's error handler.
 * @example
 * const events = await client.search.askPublishedStream({ question });
 * return toAnswerResponse(events);
 */
const toAnswerResponse = (events: AsyncIterable<AnswerEvent>): Response => {
  const iterator = events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();

  let cancelled = false;
  let completed = false;

  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const result = await iterator.next();

          if (cancelled) return;
          if (result.done) {
            if (!completed) throw new Error("Incomplete answer stream");

            controller.close();
            return;
          }

          if (result.value.type === "completed") {
            completed = true;
          }

          controller.enqueue(
            encoder.encode(
              encodeEventMessage({ event: "message", data: JSON.stringify(result.value) })
            )
          );
        } catch (error) {
          if (cancelled) return;

          const data =
            error instanceof AndesineAPIError
              ? {
                  defined: error.defined,
                  code: error.code,
                  status: error.status,
                  message: error.message,
                  data: error.data
                }
              : {
                  defined: false,
                  code: "INTERNAL_SERVER_ERROR",
                  status: 500,
                  message: "The answer stream could not be completed"
                };

          controller.enqueue(
            encoder.encode(encodeEventMessage({ event: "error", data: JSON.stringify(data) }))
          );
          controller.close();

          await iterator.return?.();
        }
      },
      async cancel() {
        cancelled = true;

        await iterator.return?.();
      }
    },
    { highWaterMark: 0 }
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
};

export { toAnswerResponse, readAnswerStream };
