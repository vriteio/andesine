import { CancelledError, CLIError, exitCodes } from "./errors";
import { isCancel } from "@clack/prompts";
import type { Readable, Writable } from "node:stream";

interface PromptOptions {
  input: Readable;
  output: Writable;
  signal: AbortSignal;
}

/** Keep Clack on stderr and prevent prompts in CI, pipes, and explicit non-interactive mode. */
const canPrompt = (interactive = true) => {
  return Boolean(interactive && process.stdin.isTTY && process.stderr.isTTY && !process.env.CI);
};
const createPrompt = (signal: AbortSignal, interactive = true) => {
  const enabled = canPrompt(interactive);

  return async <Value>(
    run: (options: PromptOptions) => Promise<Value | symbol>
  ): Promise<Value> => {
    signal.throwIfAborted();

    if (!enabled) {
      throw new CLIError(
        "Input is required. Supply the command flags or run in an interactive terminal.",
        exitCodes.usage
      );
    }

    const value = await run({ input: process.stdin, output: process.stderr, signal });

    signal.throwIfAborted();

    if (isCancel(value)) throw new CancelledError();

    return value as Value;
  };
};

export { canPrompt, createPrompt };
