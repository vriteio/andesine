import type { AnswersContext } from "../context";
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
const createAnswerClient = (context: AnswersContext): AnswerClient => {
  return {
    ask: async (question, history, signal, onUpdate) => {
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

      let answer: Answer = { text: "", sources: [], sourcesReceived: false };

      for await (const line of readLines(response.body)) {
        const event = JSON.parse(line) as AnswerEvent;

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
