import type { CommandContext } from "../context";
import { CLIError } from "../errors";
import { credentialStore } from "../storage/credentials";
import { clearProfileCredential } from "../storage/profiles";
import { withStateLock } from "../storage/lock";
import { revokeAccess } from "./oauth";

/** Remove this profile's credentials and report remote revocation separately. */
const logout = async (context: CommandContext): Promise<void> => {
  const { config, signal, output } = context;
  const reference = config.profile?.credentialRef;

  await output.heading("Andesine · Sign out");

  if (process.env.ANDESINE_API_KEY !== undefined) {
    await output.warning(
      "ANDESINE_API_KEY is unchanged. Remove it from your environment to stop using that API key."
    );
  }

  if (!reference || !config.profileName) {
    await output.diagnostic("No saved login for this profile.");
    await output.json({ loggedOut: true, localRemoved: false, revocation: "not-applicable" });
    return;
  }

  const revoked = await output.progress(
    "Signing out",
    () =>
      withStateLock(reference, signal, async (assertOwned) => {
        const store = await credentialStore(reference, signal);
        const credentials = await store.get();
        let revoked = false;

        if (
          credentials &&
          (credentials.baseURL !== config.baseURL ||
            credentials.accountID !== config.profile?.accountID)
        ) {
          throw new CLIError("Stored credentials do not match the selected instance and account.");
        }

        if (credentials && !credentials.refreshPending) {
          try {
            await revokeAccess(config.baseURL, credentials.refreshToken, signal);
            revoked = true;
          } catch {
            signal.throwIfAborted();
          }
        }

        assertOwned();
        await store.delete();
        await clearProfileCredential(config.profileName!, reference, signal);
        return revoked;
      }),
    "Local credentials removed"
  );

  await output.json({
    loggedOut: true,
    localRemoved: true,
    revocation: revoked ? "confirmed" : "unconfirmed"
  });
  await output.diagnostic(
    "Local credentials removed. Access tokens from earlier rotations may remain valid for up to 15 minutes."
  );

  if (!revoked) {
    throw new CLIError(
      "Server revocation could not be confirmed. The server grant may remain active."
    );
  }

  await output.success("Signed out. Server revocation confirmed.");
};

export { logout };
