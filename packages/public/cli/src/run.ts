import { CLIError, CancelledError, exitCodes } from "./errors";
import { createProgram } from "./program";
import { createOutput, writeOutput } from "./output";
import { CommanderError } from "commander";

/** Run the executable and release signal listeners when it finishes. */
const runCLI = async (argv = process.argv): Promise<number> => {
  const controller = new AbortController();
  const program = createProgram(controller.signal);
  const cancel = () => {
    controller.abort(new CancelledError());
  };
  const handleOutputError = (error: NodeJS.ErrnoException) => {
    const isBrokenPipe = error.code === "EPIPE";

    controller.abort(
      new CLIError(
        isBrokenPipe ? "Output pipe closed." : "Cannot write output.",
        isBrokenPipe ? exitCodes.success : exitCodes.failure
      )
    );
  };

  let exitCode: number = exitCodes.success;

  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  process.stdout.on("error", handleOutputError);
  process.stderr.on("error", handleOutputError);

  try {
    await program.parseAsync(argv);
    controller.signal.throwIfAborted();
  } catch (error) {
    if (error instanceof CommanderError) {
      exitCode = error.exitCode === 0 ? exitCodes.success : exitCodes.usage;
    } else {
      const failure: unknown = controller.signal.aborted ? controller.signal.reason : error;
      const message = failure instanceof Error ? failure.message : "Command failed.";

      exitCode = failure instanceof CLIError ? failure.exitCode : exitCodes.failure;

      if (exitCode !== exitCodes.success && !process.stderr.destroyed) {
        await createOutput(program.opts().interactive)
          .error(message)
          .catch(() => {});
      }
    }
  } finally {
    // Commander writes synchronously. Drain its queued output before releasing error handlers.
    await Promise.allSettled([writeOutput(process.stdout, ""), writeOutput(process.stderr, "")]);
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    process.stdout.removeListener("error", handleOutputError);
    process.stderr.removeListener("error", handleOutputError);
  }

  if (controller.signal.aborted) {
    const reason: unknown = controller.signal.reason;

    return reason instanceof CLIError ? reason.exitCode : exitCodes.failure;
  }

  return exitCode;
};

export { runCLI };
