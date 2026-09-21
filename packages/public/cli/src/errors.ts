/** Process exit codes shared by commands and the executable. */
const exitCodes = { success: 0, failure: 1, usage: 2, stale: 3, cancelled: 130 } as const;

class CLIError extends Error {
  constructor(
    message: string,
    readonly exitCode: number = exitCodes.failure
  ) {
    super(message);
    this.name = "CLIError";
  }
}

class CancelledError extends CLIError {
  constructor() {
    super("Cancelled.", exitCodes.cancelled);
    this.name = "CancelledError";
  }
}

export { CLIError, CancelledError, exitCodes };
