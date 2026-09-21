import { CLIError } from "../errors";
import { deviceResponseSchema, tokenResponseSchema, type TokenResponse } from "./schema";
import { setTimeout } from "node:timers/promises";
import type * as z from "zod";

const CLIENT_ID = "andesine-cli";
const SCOPES = "andesine:api offline_access";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

class OAuthError extends CLIError {
  constructor(
    readonly code: string,
    readonly retryAfter = 0
  ) {
    super("The authorization request failed. Run auth login again.");
  }
}

/** Send credentials only to this instance, in a form body, without redirects or retries. */
const oauthRequest = async (
  baseURL: string,
  endpoint: string,
  fields: Record<string, string>,
  signal: AbortSignal
): Promise<unknown> => {
  let response: Response;

  try {
    response = await fetch(`${baseURL}/auth/${endpoint}`, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "accept": "application/json"
      },
      body: new URLSearchParams({ client_id: CLIENT_ID, ...fields }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])
    });
  } catch {
    signal.throwIfAborted();
    throw new OAuthError("network_error");
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const code =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "server_error";
    const retryAfter = Number(response.headers.get("retry-after"));

    throw new OAuthError(
      response.status === 429 ? "slow_down" : code,
      Number.isFinite(retryAfter) ? Math.max(retryAfter, 0) : 0
    );
  }

  return body;
};
const parseResponse = <Schema extends z.ZodType>(
  schema: Schema,
  value: unknown
): z.output<Schema> => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new CLIError("The instance returned an invalid authorization response.");
  }

  return result.data;
};
const startDeviceLogin = async (baseURL: string, signal: AbortSignal) => {
  const device = parseResponse(
    deviceResponseSchema,
    await oauthRequest(baseURL, "device/code", { scope: SCOPES, resource: baseURL }, signal)
  );
  const verification = new URL(device.verification_uri);
  const complete = new URL(device.verification_uri_complete || device.verification_uri);
  const validProtocol =
    verification.protocol === "https:" ||
    (new URL(baseURL).protocol === "http:" && verification.protocol === "http:");
  const validDestination =
    validProtocol &&
    !verification.username &&
    !verification.password &&
    complete.origin === verification.origin &&
    complete.pathname === verification.pathname &&
    !complete.username &&
    !complete.password &&
    !complete.hash &&
    (!device.verification_uri_complete ||
      complete.searchParams.get("user_code") === device.user_code);

  if (!validDestination) {
    throw new CLIError("The instance returned an invalid browser authorization URL.");
  }

  return device;
};
const pollDeviceLogin = async (
  baseURL: string,
  device: Awaited<ReturnType<typeof startDeviceLogin>>,
  expiresAt: number,
  signal: AbortSignal
): Promise<TokenResponse> => {
  let interval = device.interval * 1000;

  while (Date.now() < expiresAt) {
    await setTimeout(Math.min(interval, Math.max(expiresAt - Date.now(), 0)), undefined, {
      signal
    });
    if (Date.now() >= expiresAt) break;

    try {
      return parseResponse(
        tokenResponseSchema,
        await oauthRequest(
          baseURL,
          "oauth2/token",
          {
            grant_type: DEVICE_GRANT,
            device_code: device.device_code,
            resource: baseURL
          },
          signal
        )
      );
    } catch (error) {
      if (!(error instanceof OAuthError)) throw error;

      if (error.code === "authorization_pending") continue;

      if (error.code === "slow_down") {
        interval = Math.max(interval + 5000, error.retryAfter * 1000);
        continue;
      }

      if (error.code === "network_error" || error.code === "server_error") {
        interval = Math.max(interval * 2, 5000);
        continue;
      }

      if (error.code === "access_denied") throw new CLIError("Login was denied in the browser.");

      if (error.code === "expired_token") break;

      throw new CLIError("The login request is no longer valid. Run auth login again.");
    }
  }

  throw new CLIError("The login code expired. Run auth login again.");
};
const refreshAccess = async (baseURL: string, refreshToken: string, signal: AbortSignal) => {
  return parseResponse(
    tokenResponseSchema,
    await oauthRequest(
      baseURL,
      "oauth2/token",
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        resource: baseURL
      },
      signal
    )
  );
};
const revokeAccess = async (
  baseURL: string,
  refreshToken: string,
  signal: AbortSignal
): Promise<void> => {
  await oauthRequest(
    baseURL,
    "oauth2/revoke",
    { token: refreshToken, token_type_hint: "refresh_token" },
    signal
  );
};

export { startDeviceLogin, pollDeviceLogin, refreshAccess, revokeAccess };
