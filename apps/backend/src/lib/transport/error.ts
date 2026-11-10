import { ORPCError } from "@orpc/server";

const withErrorHints = (error: unknown) => {
  if (!(error instanceof ORPCError)) return error;

  const data = error.data && typeof error.data === "object" ? error.data : {};
  const hints =
    error.code === "UNAUTHORIZED"
      ? ["Use a valid API key or OAuth access token for this Andesine instance, or sign in again."]
      : error.code === "BAD_REQUEST" && "issues" in data
        ? ["Correct the fields listed in issues before submitting the request again."]
        : undefined;

  if (!hints || "hints" in data) return error;

  return new ORPCError(error.code, {
    status: error.status,
    defined: error.defined,
    message: error.message,
    cause: error,
    data: { ...data, hints }
  });
};

const setErrorResponseHeaders = (error: unknown, headers?: Headers): void => {
  if (!(error instanceof ORPCError) || error.code !== "TOO_MANY_REQUESTS") return;

  const retryAfter = error.data?.retryAfterSeconds;

  if (typeof retryAfter === "number" && Number.isInteger(retryAfter) && retryAfter >= 0) {
    headers?.set("Retry-After", String(retryAfter));
  }
};

export { withErrorHints, setErrorResponseHeaders };
