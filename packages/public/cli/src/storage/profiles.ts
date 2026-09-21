import { readConfigFile } from "../config/files";
import { getUserConfigPath } from "../config/resolve";
import { userConfigSchema, type UserProfile } from "../config/schema";
import { CLIError } from "../errors";
import { writePrivateJSON } from "./files";
import { withStateLock } from "./lock";

/** Compare before writing, so a concurrent login cannot replace an unseen profile. */
const saveProfile = async (
  name: string,
  profile: UserProfile,
  expected: UserProfile | undefined,
  signal: AbortSignal
): Promise<void> => {
  await withStateLock("profiles", signal, async (assertOwned) => {
    const file = getUserConfigPath(process.env);
    const config = (await readConfigFile(file, userConfigSchema, true)) || {
      version: 1 as const,
      profiles: {}
    };
    const previous = Object.hasOwn(config.profiles, name) ? config.profiles[name] : undefined;

    if (JSON.stringify(previous) !== JSON.stringify(expected)) {
      throw new CLIError(
        "This profile changed during login. Retry with a different --profile name."
      );
    }

    assertOwned();
    await writePrivateJSON(file, {
      ...config,
      defaultProfile: config.defaultProfile || name,
      profiles: { ...config.profiles, [name]: profile }
    });
  });
};
const clearProfileCredential = async (
  name: string,
  reference: string,
  signal: AbortSignal
): Promise<void> => {
  await withStateLock("profiles", signal, async (assertOwned) => {
    const file = getUserConfigPath(process.env);
    const config = await readConfigFile(file, userConfigSchema, true);
    const profile =
      config && Object.hasOwn(config.profiles, name) ? config.profiles[name] : undefined;

    if (!config || profile?.credentialRef !== reference) return;

    const { credentialRef: _, ...remaining } = profile;

    assertOwned();
    await writePrivateJSON(file, {
      ...config,
      profiles: { ...config.profiles, [name]: remaining }
    });
  });
};

export { saveProfile, clearProfileCredential };
