import { client } from "#web/lib/api";

interface StreamSearchAnswerOptions {
  signal: AbortSignal;
  workspaceID: string;
  onUpdate(answer: SearchAnswer): void;
}
interface SearchAnswer extends Pick<
  Extract<SearchAnswerEvent, { type: "completed" }>,
  "answer" | "sources"
> {
  sourcesReceived: boolean;
}

type SearchAnswerEvent =
  Awaited<ReturnType<typeof client.search.askCurrentStream>> extends AsyncIterable<infer Event>
    ? Event
    : never;

const streamSearchAnswer = async (
  input: Parameters<typeof client.search.askCurrentStream>[0],
  options: StreamSearchAnswerOptions
): Promise<void> => {
  options.signal.throwIfAborted();

  const events = await client.search.askCurrentStream(input, {
    signal: options.signal,
    context: { headers: { "x-workspace-id": options.workspaceID } }
  });

  let answer: SearchAnswer = { answer: "", sources: [], sourcesReceived: false };

  for await (const event of events) {
    options.signal.throwIfAborted();

    switch (event.type) {
      case "sources":
        answer = { ...answer, sources: event.sources, sourcesReceived: true };
        break;
      case "textDelta":
        answer = { ...answer, answer: answer.answer + event.text };
        break;
      case "completed":
        answer = { answer: event.answer, sources: event.sources, sourcesReceived: true };
        break;
    }

    options.onUpdate(answer);

    if (event.type === "completed") return;
  }

  options.signal.throwIfAborted();

  throw new Error("The answer stream ended before completion. Please try again.");
};

export { streamSearchAnswer };
export type { SearchAnswer };
