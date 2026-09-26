// Abort before returning the generator: return() alone waits for a pending next().
const createAbortableIterator = <T>(
  generate: (signal: AbortSignal) => AsyncGenerator<T, void, unknown>,
  signal?: AbortSignal
): AsyncIteratorObject<T, void, unknown> => {
  const controller = new AbortController();
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const iterator = generate(combinedSignal);

  return {
    next: () => iterator.next(),
    return: async () => {
      controller.abort();
      return iterator.return();
    },
    throw: async (error: unknown) => {
      controller.abort(error);
      return iterator.throw(error);
    },
    async [Symbol.asyncDispose]() {
      controller.abort();
      await iterator.return();
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
};

// Bound a single unterminated provider event, not the answer or source content.
const MAX_EVENT_CHARACTERS = 1_048_576;

async function* readEventData(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const cancel = () => {
    void reader.cancel(signal.reason).catch(() => {});
  };

  let line = "";
  let data = "";
  let skipLF = false;
  let eventCharacters = 0;

  signal.addEventListener("abort", cancel, { once: true });

  try {
    signal.throwIfAborted();

    while (true) {
      const { value, done } = await reader.read();
      const text = decoder.decode(value, { stream: !done });

      signal.throwIfAborted();

      for (const character of text) {
        if (skipLF && character === "\n") {
          skipLF = false;
          continue;
        }

        skipLF = character === "\r";

        eventCharacters++;

        if (eventCharacters > MAX_EVENT_CHARACTERS) {
          throw new Error("The AI API returned an oversized stream event");
        }

        if (character !== "\r" && character !== "\n") {
          line += character;
          continue;
        }

        if (!line) {
          if (data) {
            signal.throwIfAborted();
            yield data.slice(0, -1);
          }

          data = "";
          eventCharacters = 0;
        } else if (line === "data" || line.startsWith("data:")) {
          const value = line.slice(5);

          data += `${value.startsWith(" ") ? value.slice(1) : value}\n`;
        }

        line = "";
      }

      if (done) return;
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export { createAbortableIterator, readEventData };
