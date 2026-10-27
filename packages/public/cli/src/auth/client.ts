import { createClient, AndesineAPIError } from "@andesine/sdk";
import type { CommandContext } from "../context";
import { CLIError } from "../errors";
import { credentialStore } from "../storage/credentials";
import { withStateLock } from "../storage/lock";
import { OAuthError, refreshAccess } from "./oauth";

const ACCESS_TOKEN_MIN_VALIDITY_MS = 60_000;
const ACCESS_TOKEN_REUSE_MS = ACCESS_TOKEN_MIN_VALIDITY_MS / 2;
// OAuth errors after which only a new login helps; others, e.g. an unreachable instance, pass.
const LOGIN_ERRORS = new Set(["invalid_grant", "invalid_client", "unauthorized_client"]);

/** The saved OAuth access token of the selected profile, refreshed when it expires soon. */
const getAccessToken = async (context: CommandContext): Promise<string> => {
  const { config, signal } = context;
  const reference = config.profile?.credentialRef;

  if (!reference) {
    throw new CLIError(
      "No credentials for this instance. Run andesine auth login or set ANDESINE_API_KEY."
    );
  }

  return withStateLock(reference, signal, async (assertOwned) => {
    const store = await credentialStore(reference, signal);
    const credentials = await store.get();

    if (!credentials) throw new CLIError("Saved credentials were not found. Run auth login again.");

    if (
      credentials.baseURL !== config.baseURL ||
      credentials.accountID !== config.profile?.accountID
    ) {
      throw new CLIError(
        "Saved credentials do not match this instance and account. Run auth login again."
      );
    }

    const isValid = credentials.expiresAt > Date.now() + ACCESS_TOKEN_MIN_VALIDITY_MS;

    // An exchange that was cut off, e.g. by a killed process, is tried once more with its refresh
    // token: if the server already rotated it, the server refuses it and a login is needed.
    if (isValid && !credentials.refreshPending) return credentials.accessToken;

    assertOwned();

    await store.set({ ...credentials, refreshPending: true });

    assertOwned();

    try {
      const startedAt = Date.now();
      const tokens = await refreshAccess(config.baseURL, credentials.refreshToken, signal);

      assertOwned();

      await store.set({
        ...credentials,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: startedAt + tokens.expires_in * 1000,
        refreshPending: false
      });
      return tokens.access_token;
    } catch (error) {
      signal.throwIfAborted();

      const isTemporary = error instanceof OAuthError && !LOGIN_ERRORS.has(error.code);

      // The token stays pending, so the next command tries it again.
      if (isTemporary) throw new CLIError("Could not refresh the login. Try again.");

      throw new CLIError("The login expired or was revoked. Run auth login again.");
    }
  });
};
/**
 * Select one credential source explicitly; never fall back after an authentication error.
 * With `refreshEachRequest`, each request uses a current OAuth token, for long-running commands.
 */
const authenticatedClient = async (context: CommandContext, refreshEachRequest = false) => {
  const { config, signal } = context;
  const apiKey = process.env.ANDESINE_API_KEY;
  const headers = config.workspaceID ? { "x-workspace-id": config.workspaceID } : undefined;
  const fetcher: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      redirect: "error",
      signal: AbortSignal.any([
        signal,
        ...(init?.signal ? [init.signal] : []),
        ...(input instanceof Request ? [input.signal] : [])
      ])
    });

  if (apiKey !== undefined) {
    if (!apiKey.trim()) {
      throw new CLIError(
        "ANDESINE_API_KEY is empty. Set it or remove it before using saved credentials."
      );
    }

    return {
      client: createClient({ baseURL: config.baseURL, apiKey, headers, fetch: fetcher }),
      source: "environment" as const
    };
  }

  const reference = config.profile!.credentialRef!;
  let accessToken = await getAccessToken(context);
  let accessTokenReadAt = Date.now();
  // A read token stays valid for at least a minute, so it is reused for half of that.
  const refreshingFetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);

    if (Date.now() - accessTokenReadAt > ACCESS_TOKEN_REUSE_MS) {
      accessToken = await getAccessToken(context);
      accessTokenReadAt = Date.now();
    }

    request.headers.set("Authorization", `Bearer ${accessToken}`);

    return fetcher(request);
  };

  return {
    client: createClient({
      baseURL: config.baseURL,
      accessToken,
      headers,
      fetch: refreshEachRequest ? refreshingFetcher : fetcher
    }),
    source: reference.startsWith("file:") ? ("file" as const) : ("keyring" as const)
  };
};

/** Do not expose server error bodies or retry a dispatched request during auth recovery. */
const identity = async (client: ReturnType<typeof createClient>, signal: AbortSignal) => {
  try {
    return await client.auth.getIdentity(undefined, { signal });
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof AndesineAPIError && (error.status === 401 || error.status === 403)) {
      throw new CLIError(
        "The credential is not authorized. Check ANDESINE_API_KEY or run auth login again."
      );
    }
    throw new CLIError(
      "Cannot verify this credential with the instance. Check the connection and base URL."
    );
  }
};

export { authenticatedClient, getAccessToken, identity };
