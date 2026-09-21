import { APIError } from "better-auth/api";
import * as z from "zod";

interface DeviceRequestDetails {
  status: string;
  client_id?: string;
  scope?: string;
  resource?: string | string[];
}

type DeviceRequestState = z.infer<typeof deviceRequestStateType>;

const deviceUserCodeType = z
  .string()
  .max(32)
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(
    z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/, "Enter the eight-character code from your terminal")
  );
const deviceRequestStateType = z.enum([
  "pending",
  "approved",
  "denied",
  "expired",
  "unavailable",
  "processed",
  "account-mismatch",
  "unsupported"
]);
const getDeviceRequestState = (
  details: DeviceRequestDetails,
  expected: { clientID: string; scopes: string[]; resource: string }
): DeviceRequestState => {
  if (details.status === "approved" || details.status === "denied") return details.status;
  if (!details.client_id) return "account-mismatch";

  const scopes = details.scope?.split(/\s+/) || [];
  const resources = Array.isArray(details.resource) ? details.resource : [details.resource];
  const supported =
    details.status === "pending" &&
    details.client_id === expected.clientID &&
    scopes.length === expected.scopes.length &&
    expected.scopes.every((scope) => scopes.includes(scope)) &&
    resources.length === 1 &&
    resources[0] === expected.resource;

  return supported ? "pending" : "unsupported";
};
const getDeviceRequestErrorState = (error: unknown): DeviceRequestState => {
  if (!(error instanceof APIError)) throw error;
  if (error.body?.error === "expired_token") return "expired";
  if (error.body?.error === "access_denied") return "account-mismatch";
  if (error.body?.error_description === "Device code already processed") return "processed";
  if (error.body?.error === "invalid_request") return "unavailable";

  throw error;
};

export {
  deviceUserCodeType,
  deviceRequestStateType,
  getDeviceRequestState,
  getDeviceRequestErrorState
};
export type { DeviceRequestState };
