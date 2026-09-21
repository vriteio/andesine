import { AndesineAPIError, AndesineStreamProtocolError } from "@andesine/sdk";
import type { CommandContext } from "../context";
import { CLIError } from "../errors";

/** Keep structured API failures on stderr without exposing response bodies or credentials. */
const reportAPIError = async (context: CommandContext, error: unknown): Promise<never> => {
  context.signal.throwIfAborted();

  if (error instanceof AndesineAPIError || error instanceof AndesineStreamProtocolError) {
    const response = error.response;
    const details =
      error instanceof AndesineAPIError
        ? {
            status: error.status,
            data: error.defined ? error.data : undefined,
            hints: error.hints
          }
        : {};

    await context.output.diagnostic(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          ...details,
          requestID: response.headers.get("x-request-id") ?? undefined,
          retryAfter: response.headers.get("retry-after") ?? undefined
        }
      })
    );

    const missingCapability = error instanceof AndesineAPIError && error.status === 501;

    throw new CLIError(
      missingCapability
        ? `${error.message} This server may not support the operation. Check its capabilities and version.`
        : error.message
    );
  }

  throw error;
};

export { reportAPIError };
