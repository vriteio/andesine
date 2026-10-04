import { readAnswerStream } from "@andesine/sdk/streaming";
import type { AndesineAPIContext, AnswersContext } from "../context";
import { loadEntryPages } from "./entry-pages";
import { toAnswerSources } from "./items";
import { isRateLimited, readErrorData } from "./limits";
import type { Answer, AnswerEvent, AnswerMessage, AnswerSource } from "./types";

interface AnswerHistoryTurn {
  question: string;
  answer?: Pick<Answer, "text">;
}

interface AnswerSourceGroup {
  /** The page of the first source. */
  href: string;
  sources: AnswerSource[];
}

interface AnswerClient {
  /**
   * Streams an answer and calls `onUpdate` for each change. `history` holds the earlier turns,
   * for follow-up questions. Resolves with the completed answer; aborting the signal cancels it.
   */
  ask(
    question: string,
    history: AnswerHistoryTurn[],
    signal: AbortSignal,
    onUpdate: (answer: Answer) => void
  ): Promise<Answer>;
}

/** The API accepts 10 history messages of up to 4,000 characters. */
const toMessages = (turns: AnswerHistoryTurn[]): AnswerMessage[] => {
  return turns
    .flatMap((turn): AnswerMessage[] => {
      return [
        { role: "user", content: turn.question.slice(0, 4000) },
        { role: "assistant", content: turn.answer?.text.slice(0, 4000) ?? "" }
      ];
    })
    .filter((message) => message.content.trim())
    .slice(-10);
};
/** Groups answer sources by page, in order. */
const groupAnswerSources = (sources: AnswerSource[]): AnswerSourceGroup[] => {
  const groups = new Map<string, AnswerSourceGroup>();

  for (const source of sources) {
    const page = source.href.split("#")[0]!;
    const group = groups.get(page);

    if (group) {
      group.sources.push(source);
    } else {
      groups.set(page, { href: source.href, sources: [source] });
    }
  }

  return [...groups.values()];
};
const readLines = async function* (body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";
      yield* lines.filter(Boolean);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
};
/** Streams the events of the site's answers route. */
const readServerEvents = async function* (
  context: AnswersContext,
  question: string,
  history: AnswerHistoryTurn[],
  signal: AbortSignal
): AsyncGenerator<AnswerEvent> {
  const response = await fetch(context.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: context.source, question, history: toMessages(history) }),
    signal
  });

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };

    throw new Error(body.error ?? "AI answers are not available now.");
  }

  for await (const line of readLines(response.body)) yield JSON.parse(line) as AnswerEvent;
};
/** Streams the events of the Andesine API with a publishable key, and links the cited pages. */
const readAPIEvents = async function* (
  api: AndesineAPIContext,
  question: string,
  history: AnswerHistoryTurn[],
  signal: AbortSignal
): AsyncGenerator<AnswerEvent> {
  const [resolve, response] = await Promise.all([
    loadEntryPages(api.pages),
    fetch(`${api.url}/search/published/ask/stream`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${api.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        history: toMessages(history),
        collectionID: api.collection,
        channel: "published"
      }),
      signal
    })
  ]);

  if (!response.ok) {
    throw new Error(
      isRateLimited(response.status, await readErrorData(response))
        ? "Too many questions. Try again soon."
        : "AI answers are not available now."
    );
  }

  try {
    for await (const event of await readAnswerStream(response, { signal })) {
      if (event.type === "textDelta") {
        yield { type: "textDelta", text: event.text };
      } else if (event.type === "sources") {
        yield { type: "sources", sources: toAnswerSources(event.sources, resolve) };
      } else {
        yield {
          type: "completed",
          answer: event.answer,
          sources: toAnswerSources(event.sources, resolve)
        };
      }
    }
  } catch (error) {
    signal.throwIfAborted();
    console.error(error);
    throw new Error("The answer could not be completed.");
  }
};
const createAnswerClient = (context: AnswersContext): AnswerClient => {
  return {
    ask: async (question, history, signal, onUpdate) => {
      const events = context.api
        ? readAPIEvents(context.api, question, history, signal)
        : readServerEvents(context, question, history, signal);

      let answer: Answer = { text: "", sources: [], sourcesReceived: false };

      for await (const event of events) {
        if (event.type === "error") throw new Error(event.error);

        if (event.type === "sources") {
          answer = { ...answer, sources: event.sources, sourcesReceived: true };
        } else if (event.type === "textDelta") {
          answer = { ...answer, text: answer.text + event.text };
        } else {
          answer = { text: event.answer, sources: event.sources, sourcesReceived: true };
        }

        onUpdate(answer);

        if (event.type === "completed") return answer;
      }

      signal.throwIfAborted();
      throw new Error("The answer ended before completion. Try again.");
    }
  };
};

export { createAnswerClient, groupAnswerSources };
export type { AnswerClient, AnswerHistoryTurn, AnswerSourceGroup };
