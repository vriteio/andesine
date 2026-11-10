import type { Writable } from "node:stream";
import { styleText } from "node:util";
import { intro, log, note, spinner } from "@clack/prompts";
import { CLIError } from "./errors";

/** Wait for each write so commands can stream results without an unbounded queue. */
const writeOutput = (stream: Writable, text: string | Uint8Array): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Writes with a callback can also emit an error event on the stream.
    stream.once("error", reject);
    stream.write(text, (error) => {
      if (error) reject(error);
      else {
        stream.removeListener("error", reject);
        resolve();
      }
    });
  });
};

const serializeJSON = (value: unknown): string => {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) throw new CLIError("The result is not a JSON value.");

  return `${serialized}\n`;
};

/** Data goes to stdout; prompts and diagnostics go to stderr. */
const createOutput = (interactive = true, signal?: AbortSignal) => {
  const terminal = Boolean(
    interactive && process.stderr.isTTY && !process.env.CI && process.env.TERM !== "dumb"
  );
  const options = { output: process.stderr, withGuide: true };
  const diagnostic = async (
    message: string,
    level: "info" | "success" | "warn" | "error" = "info"
  ) => {
    if (terminal) log[level](message, options);
    else await writeOutput(process.stderr, `${message}\n`);
  };

  return {
    json: (value: unknown) => writeOutput(process.stdout, serializeJSON(value)),
    text: (value: string) => writeOutput(process.stdout, value),
    diagnostic: (message: string) => diagnostic(message),
    success: (message: string) => diagnostic(message, "success"),
    warning: (message: string) => diagnostic(message, "warn"),
    error: (message: string) => diagnostic(message, "error"),
    heading: async (title: string) => {
      if (terminal) intro(styleText(["bold", "cyan"], title, { stream: process.stderr }), options);
      else await writeOutput(process.stderr, `${title}\n`);
    },
    note: async (title: string, fields: Record<string, string | undefined>) => {
      const lines = Object.entries(fields).flatMap(([label, value]) => {
        if (value === undefined) return [];

        if (!terminal) return [`${label}: ${value}`];

        return [
          `${styleText("bold", `${label}:`, { stream: process.stderr })} ${styleText("cyan", value, { stream: process.stderr })}`
        ];
      });

      if (terminal) note(lines.join("\n"), title, options);
      else await writeOutput(process.stderr, `${title}\n${lines.join("\n")}\n`);
    },
    /** Always release the spinner and its listeners before errors or later output. */
    progress: async <Value>(
      message: string,
      action: () => Promise<Value>,
      complete: string
    ): Promise<Value> => {
      const loader = terminal
        ? spinner({ ...options, signal, cancelMessage: "Cancelled." })
        : undefined;

      signal?.throwIfAborted();

      if (loader) loader.start(message);
      else await diagnostic(message);

      try {
        const result = await action();

        loader?.stop(complete);
        return result;
      } finally {
        loader?.clear();
      }
    }
  };
};

export { createOutput, writeOutput };
