import { createClient, AndesineAPIError } from "@andesine/sdk";
import type { CommandContext } from "../context";
import { CLIError } from "../errors";
import { credentialStore } from "../storage/credentials";
import { withStateLock } from "../storage/lock";
import { refreshAccess } from "./oauth";

/** Select one credential source explicitly; never fall back after an authentication error. */
const authenticatedClient = async (context: CommandContext) => {
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

  const reference = config.profile?.credentialRef;

  if (!reference) {
    throw new CLIError(
      "No credentials for this instance. Run andesine auth login or set ANDESINE_API_KEY."
    );
  }

  const accessToken = await withStateLock(reference, signal, async (assertOwned) => {
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

    if (credentials.refreshPending) {
      throw new CLIError(
        "The previous token exchange was interrupted. Run auth login again; the old refresh token will not be reused."
      );
    }

    if (credentials.expiresAt > Date.now() + 60_000) return credentials.accessToken;

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
    } catch {
      signal.throwIfAborted();
      throw new CLIError(
        "Could not complete the token exchange. Run auth login again; the previous refresh token will not be reused."
      );
    }
  });

  return {
    client: createClient({ baseURL: config.baseURL, accessToken, headers, fetch: fetcher }),
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

export { authenticatedClient, identity };
