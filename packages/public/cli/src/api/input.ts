import { readFile } from "node:fs/promises";
import path from "node:path";
import { CLIError, exitCodes } from "../errors";
import type { APICommand, APIField, APIOptions } from "./types";

const readStdin = async (signal: AbortSignal): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  const abort = () =>
    process.stdin.destroy(signal.reason instanceof Error ? signal.reason : new Error("Cancelled."));

  signal.throwIfAborted();
  signal.addEventListener("abort", abort, { once: true });

  try {
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    signal.throwIfAborted();
    return Buffer.concat(chunks);
  } finally {
    signal.removeEventListener("abort", abort);
  }
};
const optionKey = (flag: string): string =>
  flag.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

const parseFlag = (field: APIField, value: string): unknown => {
  if (field.nullable && value === "null") return null;
  if (field.kind === "string" || field.kind === "file") return value;
  if (field.kind === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new CLIError(`--${field.flag} expects true or false.`, exitCodes.usage);
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (field.kind === "number" && (typeof parsed !== "number" || !Number.isFinite(parsed))) {
      throw new Error();
    }

    return parsed;
  } catch {
    throw new CLIError(
      `--${field.flag} expects ${field.kind === "number" ? "a number" : "valid JSON"}.`,
      exitCodes.usage
    );
  }
};

/** Flat flags replace matching JSON fields; omitted flags never introduce defaults. */
const readInput = async (
  command: APICommand,
  options: APIOptions,
  signal: AbortSignal
): Promise<Record<string, unknown>> => {
  let input: Record<string, unknown> = {};
  let stdinUsed = options.input === "-";

  if (options.input !== undefined) {
    if (options.input !== "-" && !options.input.startsWith("@")) {
      throw new CLIError(
        "Use --input @file.json or --input - for JSON from stdin.",
        exitCodes.usage
      );
    }

    const source =
      options.input === "-"
        ? await readStdin(signal)
        : await readFile(options.input.slice(1), { signal });
    let parsed: unknown;

    try {
      parsed = JSON.parse(source.toString("utf8"));
    } catch {
      throw new CLIError("Input is not valid JSON.", exitCodes.usage);
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CLIError("Input must be a JSON object.", exitCodes.usage);
    }

    input = { ...parsed };
  }

  const fields = new Set(command.fields.map((field) => field.name));

  for (const name of Object.keys(input)) {
    if (!fields.has(name)) {
      throw new CLIError(`Unknown input field: ${name}. See --help or --schema.`, exitCodes.usage);
    }
  }

  for (const field of command.fields) {
    const value = options[optionKey(field.flag)];

    if (typeof value === "string") input[field.name] = parseFlag(field, value);

    const supplied = Object.hasOwn(input, field.name);

    if (field.required && !supplied) {
      throw new CLIError(`Missing ${field.name}. Use --${field.flag} or --input.`, exitCodes.usage);
    }

    if (!supplied) continue;

    const current = input[field.name];

    if (current === null && field.nullable) continue;
    if (typeof current === "number" && !Number.isFinite(current)) {
      throw new CLIError(`Invalid number for ${field.name}.`, exitCodes.usage);
    }

    if (
      field.kind !== "json" &&
      typeof current !== (field.kind === "file" ? "string" : field.kind)
    ) {
      throw new CLIError(
        `Invalid type for ${field.name}; expected ${field.kind}.`,
        exitCodes.usage
      );
    }

    if (field.kind === "file") {
      const file = current as string;

      if (file === "-" && stdinUsed) {
        throw new CLIError(
          "Stdin can supply either JSON or one upload file, not both.",
          exitCodes.usage
        );
      }

      const bytes = file === "-" ? await readStdin(signal) : await readFile(file, { signal });

      stdinUsed ||= file === "-";
      input[field.name] = new File(
        [new Uint8Array(bytes)],
        file === "-" ? "stdin" : path.basename(file),
        { type: "application/octet-stream" }
      );
    }
  }

  return input;
};

export { readInput, optionKey };
