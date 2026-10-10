import type { ExtensionStateResult } from "@andesine/contracts/extensions";
import path from "node:path";
import type { CommandContext } from "../../context";
import { compileExtension } from "../build";
import { type DevelopmentOverrides, loadExtensionProject } from "../project";
import { InstanceError, createDevelopmentClient, type DevelopmentClient } from "./client";
import { getDevelopmentKey, writeDevelopmentEnvironment } from "./environment";
import { saveDevelopmentState } from "./state";
import { watchChanges } from "./watch";

interface DevelopmentOptions {
  root: string;
  /** The local backend's environment file, relative to the root. */
  envFile: string;
  /** The local backend URL, in place of the manifest's. */
  backend?: string;
}

const STOP_TIMEOUT = 10_000;
const disabledHints: Record<string, string> = {
  approval_required: "approve its new permissions or URLs in Settings → Extensions",
  configuration_required: "fill in its required configuration in Settings → Extensions",
  manual: "enable it in Settings → Extensions",
  revoked: "its build is missing on the instance; save a file to upload it again"
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

/** Builds the project with the development key and uploads it, which installs or reloads it. */
const uploadBuild = async (
  root: string,
  context: CommandContext,
  client: DevelopmentClient,
  development: DevelopmentOverrides
): Promise<ExtensionStateResult> => {
  const project = await loadExtensionProject(root, development);
  const { frontend, styles, icons } = await compileExtension(project, context.output);
  const result = await context.output.progress(
    "Uploading the build",
    () => {
      return client.upload({
        manifest: project.manifest,
        artifacts: { frontend, styles: styles || undefined, icons: icons || undefined }
      });
    },
    "Build uploaded"
  );
  const { name, version } = project.manifest;

  await saveDevelopmentState(root, {
    baseURL: context.config.baseURL,
    workspaceID: client.workspaceID,
    extensionID: result.id
  });

  if (result.state === "active") {
    await context.output.success(`${name}@${version} is running (${result.id}).`);
  } else {
    await context.output.warning(
      `${name}@${version} is disabled: ${disabledHints[result.disabledReason ?? "manual"]}.`
    );
  }

  return result;
};

/** Runs the extension on the local instance, reloading it on changes and stopping it on exit. */
const runDevelopment = async (
  context: CommandContext,
  options: DevelopmentOptions
): Promise<void> => {
  const { output, signal } = context;
  const root = path.resolve(options.root);
  const client = createDevelopmentClient(context);
  const key = await getDevelopmentKey(root);
  const development = { keys: [key.publicKey], backendURL: options.backend };

  let extensionID: string | null = null;

  await writeDevelopmentEnvironment(root, options.envFile, key, context.config.baseURL);
  await output.note("Local backend", {
    Environment: `${options.envFile} (development key and trusted instance)`,
    Instance: context.config.baseURL
  });

  try {
    extensionID = (await uploadBuild(root, context, client, development)).id;
  } catch (error) {
    // The instance refusing the first build ends the command; a failed build waits for a fix.
    if (signal.aborted || error instanceof InstanceError) throw error;

    await output.error(getErrorMessage(error));
  }

  const changes = watchChanges(root, signal);

  try {
    await output.diagnostic("Watching for changes. Press Ctrl+C to stop the extension.");

    while (true) {
      await changes.next();

      try {
        extensionID = (await uploadBuild(root, context, client, development)).id;
      } catch (error) {
        if (signal.aborted) throw error;

        await output.error(getErrorMessage(error));
      }
    }
  } finally {
    if (extensionID) {
      await client
        .stop(extensionID, AbortSignal.timeout(STOP_TIMEOUT))
        .then(() => output.diagnostic("Development extension stopped; its state is kept."))
        .catch(() => output.warning("Could not stop the development extension."));
    }
  }
};

export { runDevelopment };
export type { DevelopmentOptions };
