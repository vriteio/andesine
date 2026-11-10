import type { client } from "#web/lib/api";

interface DeviceMessage {
  text: string;
  description: string;
}

type DeviceRequestState = Awaited<ReturnType<typeof client.auth.respondToDeviceRequest>>["state"];

const messages: Record<Exclude<DeviceRequestState, "pending">, DeviceMessage> = {
  "approved": {
    text: "CLI authorized",
    description: "Return to your terminal to finish signing in. You can close this page."
  },
  "denied": {
    text: "Request denied",
    description: "This request did not grant access. Start a new login in your terminal if needed."
  },
  "expired": {
    text: "Code expired",
    description: "This code has expired. Start a new login in your terminal."
  },
  "unavailable": {
    text: "Code unavailable",
    description:
      "This code was not found or has already been used. Check the code or start a new login in your terminal."
  },
  "processed": {
    text: "Request already processed",
    description: "Check your terminal or start a new login."
  },
  "account-mismatch": {
    text: "Account mismatch",
    description:
      "The account changed or this code belongs to another account. Sign in with that account, or start a new login in your terminal."
  },
  "unsupported": {
    text: "Unsupported request",
    description:
      "This request is not supported by Andesine CLI. Start a new login for this instance."
  }
};
const normalizeUserCode = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();
const getRequestError = (error: unknown): DeviceMessage => {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;

  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") {
    return {
      text: "Session unavailable",
      description: "Your session is no longer available. Sign in again, then try again."
    };
  }

  if (code === "TOO_MANY_REQUESTS") {
    return {
      text: "Too many attempts",
      description: "Wait a minute, then try again."
    };
  }

  return {
    text: "Could not confirm the request status",
    description: "Check your connection, then try again."
  };
};

export { messages, normalizeUserCode, getRequestError };
export type { DeviceRequestState };
