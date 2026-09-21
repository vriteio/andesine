import { CLIError, exitCodes } from "../errors";
import { findProjectConfig, readConfigFile } from "./files";
import {
  projectConfigSchema,
  typesConfigSchema,
  userConfigSchema,
  workspaceIDSchema,
  type TypesConfig,
  type UserProfile
} from "./schema";
import { homedir } from "node:os";
import path from "node:path";

interface GlobalOptions {
  config?: string;
  profile?: string;
  baseUrl?: string;
  workspace?: string;
  interactive?: boolean;
}

interface ResolveConfigOptions {
  flags?: GlobalOptions;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  userConfigPath?: string;
  allowNewProfile?: boolean;
  allowMissingConfig?: boolean;
}

interface ResolvedConfig {
  baseURL: string;
  workspaceID?: string;
  configPath?: string;
  profileName?: string;
  /** Only present when the selected profile belongs to the resolved API root. */
  profile?: UserProfile;
  types: TypesConfig;
}

/** Canonical instance identity includes the deployment prefix, not just its origin. */
const normalizeBaseURL = (value: string): string => {
  const message = "baseURL must be an HTTP(S) URL without credentials, query, or fragment.";
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new CLIError(message, exitCodes.usage);
  }

  const hasUnsupportedParts = url.username || url.password || url.search || url.hash;
  const isHTTP = url.protocol === "http:" || url.protocol === "https:";

  if (!isHTTP || hasUnsupportedParts) throw new CLIError(message, exitCodes.usage);

  return url.href.replace(/\/+$/, "");
};

/** User metadata stays outside the project. This file must never contain tokens. */
const getUserConfigPath = (env: NodeJS.ProcessEnv): string => {
  const home = homedir();
  const defaultDirectory =
    process.platform === "win32"
      ? env.APPDATA || path.join(home, "AppData", "Roaming")
      : process.platform === "darwin"
        ? path.join(home, "Library", "Application Support")
        : path.join(home, ".config");
  const directory = env.XDG_CONFIG_HOME || defaultDirectory;

  if (!path.isAbsolute(directory)) {
    throw new CLIError(
      "The user configuration directory must be an absolute path.",
      exitCodes.usage
    );
  }

  return path.join(directory, "andesine", "profiles.json");
};

/** Resolve flags > environment > project > selected profile > defaults, without credentials or I/O writes. */
const resolveConfig = async ({
  flags = {},
  cwd = process.cwd(),
  env = process.env,
  userConfigPath = getUserConfigPath(env),
  allowNewProfile = false,
  allowMissingConfig = false
}: ResolveConfigOptions = {}): Promise<ResolvedConfig> => {
  const project = await findProjectConfig(
    cwd,
    projectConfigSchema,
    flags.config ?? env.ANDESINE_CONFIG,
    allowMissingConfig
  );
  const userConfig = await readConfigFile(userConfigPath, userConfigSchema, true);
  const profileName =
    flags.profile ?? env.ANDESINE_PROFILE ?? project?.value.profile ?? userConfig?.defaultProfile;
  const selectedProfile =
    profileName && userConfig && Object.hasOwn(userConfig.profiles, profileName)
      ? userConfig.profiles[profileName]
      : undefined;

  if (profileName !== undefined && !selectedProfile && !allowNewProfile) {
    throw new CLIError(
      "The selected profile does not exist in the user configuration.",
      exitCodes.usage
    );
  }

  const profileBaseURL = selectedProfile ? normalizeBaseURL(selectedProfile.baseURL) : undefined;
  const baseURL = normalizeBaseURL(
    flags.baseUrl ??
      env.ANDESINE_BASE_URL ??
      project?.value.baseURL ??
      profileBaseURL ??
      "https://api.andesine.app"
  );
  const profile =
    selectedProfile && profileBaseURL === baseURL ? { ...selectedProfile, baseURL } : undefined;
  const workspaceID =
    flags.workspace ??
    env.ANDESINE_WORKSPACE_ID ??
    project?.value.workspaceID ??
    profile?.workspaceID;
  const types = project?.value.types ?? typesConfigSchema.parse({});
  const outputDirectory = project ? path.dirname(project.path) : path.resolve(cwd);

  if (workspaceID !== undefined && !workspaceIDSchema.safeParse(workspaceID).success) {
    throw new CLIError("workspaceID must be a workspace ID (ws_…).", exitCodes.usage);
  }

  return {
    baseURL,
    workspaceID,
    configPath: project?.path,
    profileName,
    profile,
    types: { ...types, output: path.resolve(outputDirectory, types.output) }
  };
};

export { resolveConfig, normalizeBaseURL, getUserConfigPath };
export type { GlobalOptions, ResolvedConfig, ResolveConfigOptions };
