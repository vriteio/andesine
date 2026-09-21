import type { CommandContext } from "../context";
import { CLIError, CancelledError } from "../errors";
import { credentialStore, type CredentialStore } from "../storage/credentials";
import { readConfigFile } from "../config/files";
import { getUserConfigPath, normalizeBaseURL } from "../config/resolve";
import { userConfigSchema } from "../config/schema";
import { saveProfile } from "../storage/profiles";
import { withStateLock } from "../storage/lock";
import { startDeviceLogin, pollDeviceLogin, revokeAccess } from "./oauth";
import { identity } from "./client";
import type { Credentials, StorageKind } from "./schema";
import { createClient } from "@andesine/sdk";
import { confirm } from "@clack/prompts";
import { randomUUID } from "node:crypto";
import openBrowser from "open";

interface LoginOptions {
  browser: boolean;
  credentialStore?: StorageKind;
}
interface LoginStore {
  reference: string;
  store: CredentialStore;
}

const prepareStore = async (context: CommandContext, kind: StorageKind): Promise<LoginStore> => {
  const reference = `${kind}:${randomUUID()}`;
  const store = await credentialStore(reference, context.signal);

  // Check write access before the user grants access in the browser.
  await store.set({
    version: 1,
    baseURL: context.config.baseURL,
    accountID: "probe",
    accessToken: "probe",
    refreshToken: "probe",
    expiresAt: 0,
    refreshPending: false
  });
  await store.delete();
  context.signal.throwIfAborted();
  return { reference, store };
};
const selectStore = async (
  context: CommandContext,
  selected?: StorageKind
): Promise<LoginStore> => {
  try {
    return await prepareStore(context, selected || "keyring");
  } catch (error) {
    context.signal.throwIfAborted();
    if (selected) throw error;

    await context.output.warning(
      "The OS credential store is unavailable. File storage keeps unencrypted tokens in a file restricted to your user. Use --credential-store file to select it explicitly."
    );
    const accepted = await context.prompt((options) =>
      confirm({
        ...options,
        message: "Use private file storage for this login?",
        initialValue: false
      })
    );

    if (!accepted) throw new CancelledError();
    return prepareStore(context, "file");
  }
};

/** Grant approval stays in the browser; the CLI only polls the provider and saves its tokens. */
const login = async (
  context: CommandContext,
  options: LoginOptions,
  reportResult = true
): Promise<void> => {
  const { config, signal, output } = context;
  const name = config.profileName || "default";
  const profiles = await readConfigFile(getUserConfigPath(process.env), userConfigSchema, true);
  const existing =
    profiles && Object.hasOwn(profiles.profiles, name) ? profiles.profiles[name] : undefined;

  if (existing && normalizeBaseURL(existing.baseURL) !== config.baseURL) {
    throw new CLIError(
      "This profile belongs to another instance. Use --profile with a new name for this login."
    );
  }

  await output.heading("Andesine · Sign in");
  await output.note("Login", { Instance: config.baseURL, Profile: name });

  const storage = await selectStore(context, options.credentialStore);
  const device = await output.progress(
    "Requesting a login code",
    () => startDeviceLogin(config.baseURL, signal),
    "Login code ready"
  );
  const expiresAt = Date.now() + device.expires_in * 1000;

  await output.note("Authorize in your browser", {
    Open: device.verification_uri,
    Code: device.user_code
  });
  await output.diagnostic("Approve access in your browser. Press Ctrl+C to cancel.");

  if (options.browser) {
    try {
      signal.throwIfAborted();
      await openBrowser(device.verification_uri_complete || device.verification_uri, {
        wait: false
      });
    } catch {
      signal.throwIfAborted();
      await output.warning("Could not open a browser. Open the URL above and enter the code.");
    }
  }

  const tokens = await output.progress(
    "Waiting for browser approval",
    () => pollDeviceLogin(config.baseURL, device, expiresAt, signal),
    "Browser approval received"
  );
  const tokenReceivedAt = Date.now();
  let saved = false;

  try {
    const client = createClient({
      baseURL: config.baseURL,
      accessToken: tokens.access_token,
      fetch: (input, init) => fetch(input, { ...init, redirect: "error" })
    });
    const account = await output.progress(
      "Verifying your account",
      () => identity(client, signal),
      "Account verified"
    );

    if (account.type !== "oauth") {
      throw new CLIError("The instance did not return an OAuth user identity.");
    }

    const credentials: Credentials = {
      version: 1,
      baseURL: config.baseURL,
      accountID: account.user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokenReceivedAt + tokens.expires_in * 1000,
      refreshPending: false
    };
    const commit = async () => {
      signal.throwIfAborted();
      await storage.store.set(credentials);
      await saveProfile(
        name,
        {
          baseURL: config.baseURL,
          accountID: account.user.id,
          credentialRef: storage.reference,
          ...(config.workspaceID ? { workspaceID: config.workspaceID } : {})
        },
        config.profile,
        signal
      );
      saved = true;
    };
    const previousRef = config.profile?.credentialRef;

    if (previousRef) {
      await withStateLock(previousRef, signal, async (assertOwned) => {
        assertOwned();
        await commit();
        try {
          const previousStore = await credentialStore(previousRef, signal);
          const previous = await previousStore.get();

          if (previous?.refreshPending) {
            await output.warning(
              "The previous token exchange was interrupted; its server grant may remain active."
            );
          } else if (previous) {
            if (
              previous.baseURL !== config.baseURL ||
              previous.accountID !== config.profile?.accountID
            ) {
              throw new CLIError("The previous credential does not match this account.");
            }
            await revokeAccess(config.baseURL, previous.refreshToken, signal);
          }
          await previousStore.delete();
        } catch {
          await output.warning(
            "New login saved. Could not fully remove the previous login; its server credentials may remain active."
          );
        }
      });
    } else {
      await commit();
    }

    await output.success(`Signed in as ${account.user.email}. Saved profile: ${name}.`);
    if (process.env.ANDESINE_API_KEY !== undefined) {
      await output.warning(
        "ANDESINE_API_KEY is set and will still take precedence for API requests."
      );
    }

    if (reportResult) {
      await output.json({
        authenticated: true,
        profile: name,
        baseURL: config.baseURL,
        account: account.user,
        workspaceID: config.workspaceID ?? null,
        credentialSource: storage.reference.split(":")[0]
      });
    }
  } finally {
    if (!saved) {
      await revokeAccess(config.baseURL, tokens.refresh_token, AbortSignal.timeout(10_000)).catch(
        async () => {
          await output.warning(
            "Login was not saved, and token revocation could not be confirmed. The server grant may remain active."
          );
        }
      );
      await credentialStore(storage.reference)
        .then((store) => store.delete())
        .catch(async () => {
          await output.warning("Could not remove the incomplete login from credential storage.");
        });
    }
  }
};

export { login };
export type { LoginOptions };
