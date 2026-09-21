import { setTimeout } from "node:timers/promises";
import type { TypeMetadata } from "@andesine/sdk";
import type { CommandContext } from "../context";
import { CLIError, exitCodes } from "../errors";
import { reportAPIError } from "../api/errors";
import { generateTypes } from "./generate";
import { readTypesFile, writeTypesFile } from "./file";
import { readMetadata, RetryableMetadataError } from "./metadata";
import { resolveTypes, type GenerateOptions } from "./options";

interface GenerationResult {
  outputPath: string;
  workspaceID: string;
  source: TypeMetadata["source"];
  fingerprint: string;
  status: "generated" | "unchanged" | "current" | "stale";
}
interface GenerationCache {
  fingerprint: string;
  source: string;
}

/** Generate, check, or watch using the same metadata and output comparison. */
const executeTypes = async (
  context: CommandContext,
  options: GenerateOptions = {},
  emitResult = true
): Promise<GenerationResult> => {
  const { output, signal } = context;
  const types = resolveTypes(context.config, options);
  const interval = Number(options.interval ?? "10") * 1000;

  if (options.check && (options.watch || options.force)) {
    throw new CLIError("--check cannot be combined with --watch or --force.", exitCodes.usage);
  }

  if (options.interval !== undefined && !options.watch) {
    throw new CLIError("--interval requires --watch.", exitCodes.usage);
  }

  if (!Number.isFinite(interval) || interval < 1000 || interval > 300_000) {
    throw new CLIError("--interval must be between 1 and 300 seconds.", exitCodes.usage);
  }

  let cache: GenerationCache | undefined;
  let first = true;
  let failures = 0;
  let previousFailure: string | undefined;
  let force = options.force;

  const run = async (): Promise<GenerationResult> => {
    const expected = await readTypesFile(types.output);
    const metadata = await readMetadata(context, types);
    const source =
      cache?.fingerprint === metadata.fingerprint ? cache.source : generateTypes(metadata, types);
    const changed = options.check
      ? (await readTypesFile(types.output)) !== source
      : await writeTypesFile(types.output, source, expected, signal, force);

    signal.throwIfAborted();
    cache = { fingerprint: metadata.fingerprint, source };
    force = false;

    return {
      outputPath: types.output,
      workspaceID: metadata.workspaceID,
      source: metadata.source,
      fingerprint: metadata.fingerprint,
      status: options.check ? (changed ? "stale" : "current") : changed ? "generated" : "unchanged"
    };
  };

  await output.heading(
    `Andesine · ${options.check ? "Check" : options.watch ? "Watch" : "Generate"} content types`
  );
  await output.note("Type generation", {
    Source: JSON.stringify(types.source),
    Collections: types.collections.join(", ") || "All accessible collections",
    Output: types.output
  });

  if (options.watch) {
    await output.diagnostic(`Watching every ${interval / 1000}s. Press Ctrl+C to stop.`);
  }

  while (true) {
    let delay = interval;

    signal.throwIfAborted();

    try {
      const result = first
        ? await output.progress("Reading metadata and generating types", run, "Types checked")
        : await run();
      const recovered = failures > 0;

      if (first || recovered || result.status === "generated") {
        if (recovered) await output.success("Metadata access restored.");

        if (result.status === "stale") {
          await output.warning("Generated types are missing or out of date.");
        } else {
          await output.success(
            result.status === "generated" ? "Types generated." : "Types are up to date."
          );
        }

        if (emitResult) await output.json(result);
      }

      if (result.status === "stale") {
        throw new CLIError(
          "Run andesine types generate to update the types file.",
          exitCodes.stale
        );
      }

      if (!options.watch) return result;

      first = false;
      failures = 0;
      previousFailure = undefined;
    } catch (error) {
      signal.throwIfAborted();

      if (!options.watch || !(error instanceof RetryableMetadataError)) {
        return reportAPIError(
          context,
          error instanceof RetryableMetadataError ? error.failure : error
        );
      }

      failures += 1;
      delay = Math.max(
        Math.min(interval * 2 ** Math.min(failures, 10), 60_000),
        interval,
        error.retryAfter
      );

      // Report the first failure and each changed error, then stay quiet until recovery.
      try {
        const message =
          error.failure instanceof Error ? error.failure.message : "Metadata read failed.";

        if (message !== previousFailure) {
          previousFailure = message;
          await reportAPIError(context, error.failure);
        }
      } catch (failure) {
        signal.throwIfAborted();

        const message = failure instanceof Error ? failure.message : "Metadata read failed.";

        await output.warning(
          `${message} Keeping the last types file. Retrying in ${Math.ceil(delay / 1000)}s.`
        );
      }

      first = false;
    }

    await setTimeout(Math.min(delay, 2_147_483_647), undefined, { signal });
  }
};

export { executeTypes };
export type { GenerationResult };
