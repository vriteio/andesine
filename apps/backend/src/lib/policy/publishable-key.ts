import { ORPCError } from "@orpc/server";
import type { SessionData } from "./session";

const localhostOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

/**
 * Checks that a publishable key calls an operation for publishable keys, from one of its origins
 * or localhost. Requests without `Origin` come from servers, e.g. site builds, and are allowed:
 * such callers can send any `Origin`, so the check only stops other sites' browser code.
 */
const assertPublishableKeyAccess = (
  auth: SessionData,
  isPublishableOperation: boolean,
  origin: string | null | undefined
): void => {
  const scope = auth.key?.publishable;

  if (!scope) return;

  if (!isPublishableOperation) {
    throw new ORPCError("FORBIDDEN", {
      message: "Publishable keys can only read published content and search it",
      data: { hints: ["Use a secret key on a server for this operation."] }
    });
  }

  const normalized = origin?.toLowerCase();
  const isAllowedOrigin =
    !normalized || scope.allowedOrigins.includes(normalized) || localhostOrigin.test(normalized);

  if (!isAllowedOrigin) {
    throw new ORPCError("FORBIDDEN", {
      message: "This origin cannot use the publishable key",
      data: { hints: ["Add the site's origin to the key in the Andesine app."] }
    });
  }
};

export { assertPublishableKeyAccess };
