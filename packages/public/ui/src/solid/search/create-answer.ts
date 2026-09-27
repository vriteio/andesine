import { type Accessor, createSignal, onCleanup } from "solid-js";

interface AnswerTurn<T> {
  question: string;
  answer?: T;
  status: AnswerStatus;
  error?: unknown;
}

interface AnswerOptions<T> {
  /**
   * Gets the answer to a question. `turns` has the completed earlier turns, for follow-up
   * history. Call `update` with each partial answer.
   */
  ask(
    question: string,
    turns: Array<AnswerTurn<T>>,
    signal: AbortSignal,
    update: (answer: T) => void
  ): Promise<T>;
}

interface Answer<T> {
  /** The conversation, oldest first. */
  turns: Accessor<Array<AnswerTurn<T>>>;
  pending: Accessor<boolean>;
  /** Asks a question; earlier completed turns are the history. */
  ask(question: string): void;
  /** Stops the pending answer and removes its turn. */
  cancel(): void;
  /** Stops the pending answer and clears the conversation. */
  reset(): void;
}

type AnswerStatus = "loading" | "done" | "error";

/** A conversation of streamed answers, with cancellation and follow-up questions. */
const createAnswer = <T>(options: AnswerOptions<T>): Answer<T> => {
  const [turns, setTurns] = createSignal<Array<AnswerTurn<T>>>([]);

  let controller: AbortController | undefined;

  const pending = (): boolean => turns().at(-1)?.status === "loading";
  const updateLast = (current: AbortController, turn: Partial<AnswerTurn<T>>): void => {
    if (controller !== current) return;

    setTurns((list) => [...list.slice(0, -1), { ...list.at(-1)!, ...turn }]);
  };
  const cancel = (): void => {
    controller?.abort();
    controller = undefined;

    if (pending()) setTurns((list) => list.slice(0, -1));
  };
  const run = async (question: string): Promise<void> => {
    const current = new AbortController();

    cancel();
    controller = current;

    const history = turns().filter((turn) => turn.status === "done");

    setTurns([...history, { question, status: "loading" }]);

    try {
      const answer = await options.ask(question, history, current.signal, (partial) => {
        return updateLast(current, { answer: partial });
      });

      updateLast(current, { answer, status: "done" });
    } catch (error) {
      if (current.signal.aborted) return;

      updateLast(current, { status: "error", error });
    } finally {
      if (controller === current) controller = undefined;
    }
  };

  onCleanup(cancel);

  return {
    turns,
    pending,
    cancel,
    ask: (question) => {
      run(question).catch(() => {});
    },
    reset: () => {
      cancel();
      setTurns([]);
    }
  };
};

export { createAnswer };
export type { AnswerTurn, AnswerOptions, Answer, AnswerStatus };
