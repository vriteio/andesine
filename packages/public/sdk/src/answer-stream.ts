import { EventDecoderStream } from "@orpc/standard-server";
import type { AnswerEvent } from "./generated/schema";
import { AndesineStreamError, AndesineStreamProtocolError } from "./error";

interface AnswerStreamOptions {
  signal?: AbortSignal;
  cancel?: () => void;
  cleanup?: () => void;
}

const isEventBody = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object";
};
const isStreamErrorBody = (value: Record<string, unknown>): boolean => {
  const hasCode = typeof value.code === "string";
  const status = value.status;
  const hasErrorStatus =
    typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599;

  return hasCode && hasErrorStatus;
};

const createAnswerStream = (
  response: Response,
  options: AnswerStreamOptions = {}
): AsyncIterableIterator<AnswerEvent> => {
  const body = response.body;
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const isEventStream = body !== null && contentType === "text/event-stream";
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const cancel = () => {
    controller.abort();
    options.cancel?.();
  };
  const invalid = (message: string) => {
    return new AndesineStreamProtocolError("INVALID_STREAM", response, message);
  };

  if (!isEventStream) {
    cancel();
    void body?.cancel().catch(() => {});
    throw invalid("Expected an SSE response");
  }

  const reader = body
    .pipeThrough(new TextDecoderStream("utf-8", { fatal: true }))
    .pipeThrough(new EventDecoderStream())
    .getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
    options.cleanup?.();
  };
  const cleanup = async () => {
    signal.removeEventListener("abort", abort);
    options.cleanup?.();
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  };
  const iterate = async function* (): AsyncGenerator<AnswerEvent, void, unknown> {
    let started = false;
    let completed = false;
    let answer = "";

    try {
      while (true) {
        signal.throwIfAborted();

        const frame = await reader.read();

        signal.throwIfAborted();

        if (frame.done || frame.value.event === "done") {
          if (!completed) {
            throw new AndesineStreamProtocolError(
              "INCOMPLETE_STREAM",
              response,
              "The answer stream ended without completion"
            );
          }
          return;
        }

        const { event, data } = frame.value;
        const isComment = !event && data === undefined;
        const isSupportedEvent = event === "message" || event === "error";

        if (isComment) continue;

        if (!isSupportedEvent) {
          throw invalid("Unexpected SSE event");
        }

        let value: unknown;

        try {
          value = JSON.parse(data ?? "");
        } catch {
          throw invalid("Invalid JSON in an SSE event");
        }

        if (!isEventBody(value)) throw invalid("Invalid stream event body");

        if (event === "error") {
          if (!isStreamErrorBody(value)) throw invalid("Invalid stream error body");

          throw new AndesineStreamError(response, value);
        }

        const canAcceptAnswerEvent = !completed && "type" in value;

        if (!canAcceptAnswerEvent) throw invalid("Unexpected answer event");

        switch (value.type) {
          case "sources": {
            const isValidSources = !started && Array.isArray(value.sources);

            if (!isValidSources) throw invalid("Invalid sources event");

            started = true;
            break;
          }
          case "textDelta": {
            const text = value.text;
            const isValidDelta = started && typeof text === "string" && text.length > 0;

            if (!isValidDelta) throw invalid("Invalid text delta");

            answer += text;
            break;
          }
          case "completed": {
            const hasAnswer = typeof value.answer === "string";
            const hasSources = Array.isArray(value.sources);
            const matchesDeltas = answer.length === 0 || value.answer === answer;
            const isValidCompletion = started && hasAnswer && hasSources && matchesDeltas;

            if (!isValidCompletion) throw invalid("Invalid completion event");

            completed = true;
            break;
          }
          default:
            throw invalid("Unknown answer event type");
        }

        yield value as AnswerEvent;
      }
    } catch (error) {
      signal.throwIfAborted();
      const isKnownStreamError =
        error instanceof AndesineStreamError || error instanceof AndesineStreamProtocolError;

      if (isKnownStreamError) throw error;

      throw new AndesineStreamProtocolError(
        "INCOMPLETE_STREAM",
        response,
        "The answer stream was interrupted",
        { cause: error }
      );
    } finally {
      await cleanup();
    }
  };
  const iterator = iterate();

  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();

  return {
    next: () => iterator.next(),
    return: async () => {
      cancel();
      abort();
      await cleanup();
      return iterator.return();
    },
    throw: async (error: unknown) => {
      cancel();
      abort();
      await cleanup();
      return iterator.throw(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
};

export { createAnswerStream };
