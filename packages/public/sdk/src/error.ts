import type { APIErrorCode, APIErrorData } from "./operation";

/** An HTTP API failure with its response, error code, contract data, and suggested next steps. */
class AndesineAPIError extends Error {
  readonly defined: boolean;
  readonly status: number;
  readonly code: string;
  readonly data: unknown;
  readonly response: Response;

  /**
   * @param response - Failed Fetch response, retained for status and headers such as Retry-After.
   * @param body - Parsed error envelope, or the original body for an unrecognized error format.
   */
  constructor(response: Response, body: unknown) {
    const error = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    super(
      typeof error.message === "string"
        ? error.message
        : `Andesine request failed (${response.status})`
    );
    this.name = "AndesineAPIError";
    this.defined = error.defined === true;
    this.status = response.status;
    this.code = typeof error.code === "string" ? error.code : "HTTP_ERROR";
    this.data = "code" in error ? error.data : body;
    this.response = response;
  }
  /**
   * Check and narrow the code and data of an error declared by the API contract.
   * @param code - Contract error code to match.
   * @returns True only when the API marks the error as defined and its code matches.
   */
  is<C extends APIErrorCode>(
    code: C
  ): this is this & { defined: true; code: C; data: APIErrorData<C> } {
    return this.defined && this.code === code;
  }

  /** Suggested next steps. Do not use the wording for program logic. */
  get hints(): string[] {
    const hints =
      this.data && typeof this.data === "object" && "hints" in this.data
        ? this.data.hints
        : undefined;

    return Array.isArray(hints)
      ? hints.filter((hint): hint is string => typeof hint === "string")
      : [];
  }
}

/** An API error frame received after SSE headers. status is the frame status, not HTTP 200. */
class AndesineStreamError extends AndesineAPIError {
  override readonly status: number;
  /**
   * @param response - Original SSE response; response.status retains its actual HTTP status.
   * @param body - Parsed error frame. Its numeric status overrides the HTTP status on this error.
   */
  constructor(response: Response, body: unknown) {
    super(response, body);
    this.name = "AndesineStreamError";
    this.status =
      body && typeof body === "object" && "status" in body && typeof body.status === "number"
        ? body.status
        : response.status;
  }
}

/** A local invalid/incomplete stream failure. It does not invent an API error or HTTP status. */
class AndesineStreamProtocolError extends Error {
  readonly code: "INVALID_STREAM" | "INCOMPLETE_STREAM";
  readonly response: Response;

  /**
   * @param code - INVALID_STREAM for malformed events; INCOMPLETE_STREAM for missing completion.
   * @param response - Original SSE response for inspection.
   * @param message - Description of the protocol failure.
   * @param options - Optional underlying cause.
   */
  constructor(
    code: "INVALID_STREAM" | "INCOMPLETE_STREAM",
    response: Response,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "AndesineStreamProtocolError";
    this.code = code;
    this.response = response;
  }
}

export { AndesineAPIError, AndesineStreamError, AndesineStreamProtocolError };
