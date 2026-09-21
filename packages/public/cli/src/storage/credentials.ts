import { credentialsSchema, type Credentials, type StorageKind } from "../auth/schema";
import { CLIError } from "../errors";
import { ensurePrivateDirectory, isMissing, stateDirectory, writePrivateJSON } from "./files";
import { constants } from "node:fs";
import { open, unlink } from "node:fs/promises";
import path from "node:path";

interface CredentialStore {
  get(): Promise<Credentials | undefined>;
  set(value: Credentials): Promise<void>;
  delete(): Promise<void>;
}

const parseCredentials = (value: string): Credentials => {
  try {
    return credentialsSchema.parse(JSON.parse(value));
  } catch {
    throw new CLIError("Stored credentials are invalid. Run auth login again.");
  }
};
const credentialStore = async (
  reference: string,
  signal?: AbortSignal
): Promise<CredentialStore> => {
  const match = /^(keyring|file):([a-f0-9-]{36})$/.exec(reference);

  if (!match) throw new CLIError("Invalid credential reference. Run auth login again.");

  const kind = match[1] as StorageKind;
  const id = match[2];

  if (kind === "keyring") {
    try {
      const { AsyncEntry } = await import("@napi-rs/keyring");
      const entry = new AsyncEntry("app.andesine.cli", id, { linux: { store: "secret-service" } });
      const safely = async <Value>(
        run: (signal: AbortSignal) => Promise<Value>
      ): Promise<Value> => {
        try {
          return await run(
            AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])])
          );
        } catch {
          throw new CLIError(
            "The OS credential store is unavailable. Unlock it and try again, or use auth login --credential-store file."
          );
        }
      };

      return {
        get: async () => {
          const value = await safely((signal) => entry.getPassword(signal));
          return value === undefined ? undefined : parseCredentials(value);
        },
        set: (value) => safely((signal) => entry.setPassword(JSON.stringify(value), signal)),
        delete: async () => {
          await safely((signal) => entry.deletePassword(signal));
        }
      };
    } catch {
      throw new CLIError(
        "The OS credential store is unavailable. Use auth login --credential-store file for explicit file storage."
      );
    }
  }

  const directory = path.join(stateDirectory(), "credentials");
  const file = path.join(directory, `${id}.json`);

  return {
    get: async () => {
      await ensurePrivateDirectory(directory);

      let handle;

      try {
        handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
        const info = await handle.stat();
        const privateFile =
          process.platform === "win32" ||
          ((info.mode & 0o077) === 0 && info.uid === process.getuid?.());

        if (!info.isFile() || !privateFile) {
          throw new CLIError(
            "Credential file permissions must allow only the current user (0600)."
          );
        }

        return parseCredentials(await handle.readFile("utf8"));
      } catch (error) {
        if (isMissing(error)) return undefined;

        if (error instanceof CLIError) throw error;
        throw new CLIError("Cannot read the credential file.");
      } finally {
        await handle?.close();
      }
    },
    set: (value) => writePrivateJSON(file, value),
    delete: async () => {
      await unlink(file).catch((error: unknown) => {
        if (!isMissing(error)) throw new CLIError("Cannot remove the credential file.");
      });
    }
  };
};

export { credentialStore };
export type { CredentialStore };
