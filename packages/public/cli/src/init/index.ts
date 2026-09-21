import { confirm, select } from "@clack/prompts";
import { createCommandContext, type CommandContext } from "../context";
import { authenticatedClient, identity } from "../auth/client";
import { login } from "../auth/login";
import { readConfigFile } from "../config/files";
import { projectConfigSchema, typesConfigSchema, type ProjectConfig } from "../config/schema";
import { CancelledError, CLIError, exitCodes } from "../errors";
import { canPrompt } from "../prompts";
import { validateCollections } from "../content/collections";
import { selectTypes } from "./choices";
import { readProjectFile, writeProjectConfig } from "./write-config";
import type { InitOptions } from "./options";
import { validateTypeOptions } from "../types/options";
import { executeTypes } from "../types/execute";
import path from "node:path";

const selectWorkspace = async (context: CommandContext, interactive: boolean): Promise<string> => {
  const { client } = await authenticatedClient(context);
  const account = await context.output.progress(
    "Checking your account",
    () => identity(client, context.signal),
    "Account verified"
  );
  const configured = context.config.workspaceID;

  if (account.type === "key") {
    if (configured && configured !== account.workspaceID) {
      throw new CLIError(
        "This API key belongs to another workspace. Change --workspace or ANDESINE_API_KEY."
      );
    }

    await context.output.note("API key", {
      Instance: context.config.baseURL,
      Workspace: account.workspaceID
    });
    return account.workspaceID;
  }

  await context.output.note("Account", {
    Instance: context.config.baseURL,
    Email: account.user.email,
    Profile: context.config.profileName
  });

  const workspaces = await context.output.progress(
    "Loading workspaces",
    () => client.workspaces.list(undefined, { signal: context.signal }),
    "Workspaces loaded"
  );

  if (configured && !workspaces.some((workspace) => workspace.id === configured)) {
    throw new CLIError(
      "The selected workspace is not available to this account. Use --workspace with an accessible workspace ID.",
      exitCodes.usage
    );
  }

  if (!workspaces.length) {
    throw new CLIError("No workspaces are available. Create a workspace in Andesine first.");
  }
  if (!interactive && configured) return configured;
  if (workspaces.length === 1) return workspaces[0].id;

  if (!interactive) {
    throw new CLIError(
      "Several workspaces are available. Supply --workspace <id> or run init in an interactive terminal.",
      exitCodes.usage
    );
  }

  return context.prompt((prompt) =>
    select({
      ...prompt,
      message: "Workspace",
      initialValue: configured,
      options: workspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.name,
        hint: workspace.id
      }))
    })
  );
};

const describeConfig = (config: ProjectConfig): Record<string, string | undefined> => ({
  "Instance": config.baseURL,
  "Workspace": config.workspaceID,
  "Profile": config.profile,
  "Source": config.types ? JSON.stringify(config.types.source) : undefined,
  "Collections": config.types
    ? config.types.collections.join(", ") || "All accessible collections"
    : undefined,
  "Output": config.types?.output,
  "Entry IDs": config.types ? String(config.types.includeEntryIDs) : undefined,
  "Entry paths": config.types ? String(config.types.includeEntryPaths) : undefined,
  "Exact tree": config.types ? String(config.types.includeTree) : undefined
});

/** Configure a project through the public API; never save credentials in the project. */
const init = async (options: InitOptions, signal: AbortSignal): Promise<void> => {
  const interactive = canPrompt(options.interactive);

  validateTypeOptions(options);

  let context = await createCommandContext(options, signal, {
    allowNewProfile: true,
    allowMissingConfig: true
  });

  const explicitPath = options.config ?? process.env.ANDESINE_CONFIG;
  const explicitProfile = options.profile ?? process.env.ANDESINE_PROFILE;
  const file = path.resolve(explicitPath ?? context.config.configPath ?? "andesine.json");
  const original = await readProjectFile(file);
  const previous = await readConfigFile(file, projectConfigSchema, true);

  await context.output.heading("Andesine · Initialize project");

  const needsLogin =
    process.env.ANDESINE_API_KEY === undefined && !context.config.profile?.credentialRef;

  if (needsLogin) {
    if (!interactive) {
      throw new CLIError(
        "Sign in with andesine auth login or set ANDESINE_API_KEY before running init non-interactively.",
        exitCodes.usage
      );
    }

    const approved = await context.prompt((prompt) =>
      confirm({ ...prompt, message: `Sign in to ${context.config.baseURL}?`, initialValue: true })
    );

    if (!approved) throw new CancelledError();

    await login(context, options, false);
    context = await createCommandContext(options, signal, { allowMissingConfig: true });
  }

  const workspaceID = await selectWorkspace(
    context,
    interactive && options.workspace === undefined
  );
  const scopedContext = { ...context, config: { ...context.config, workspaceID } };
  const { client } = await authenticatedClient(scopedContext);
  const types = await selectTypes(
    scopedContext,
    client,
    options,
    previous?.types ?? typesConfigSchema.parse({})
  );

  await context.output.progress(
    "Validating the selected content",
    () => validateCollections(client, types.source, types.collections, signal),
    "Content selection verified"
  );

  const config: ProjectConfig = {
    ...previous,
    $schema:
      previous?.$schema ??
      path
        .relative(path.dirname(file), path.resolve("node_modules/andesine/dist/config.schema.json"))
        .split(path.sep)
        .join("/"),
    version: 1,
    baseURL: context.config.baseURL,
    workspaceID,
    ...(explicitProfile !== undefined ? { profile: explicitProfile } : {}),
    types
  };
  const details = describeConfig(config);
  const previousDetails = previous ? describeConfig(previous) : undefined;
  const changes = Object.fromEntries(
    Object.entries(details)
      .filter(([label, value]) => !previousDetails || previousDetails[label] !== value)
      .map(([label, value]) => [
        label,
        previousDetails ? `${previousDetails[label] ?? "Not set"} → ${value ?? "Not set"}` : value
      ])
  );
  const unchanged = previous && JSON.stringify(previous) === JSON.stringify(config);

  await context.output.note(
    unchanged
      ? "Configuration unchanged"
      : previous
        ? "Update configuration"
        : "Create configuration",
    { File: file, ...changes }
  );

  if (!unchanged) {
    if (interactive && !options.yes) {
      const approved = await context.prompt((prompt) =>
        confirm({
          ...prompt,
          message: previous ? "Save these changes?" : "Create this configuration?",
          initialValue: true
        })
      );

      if (!approved) throw new CancelledError();
    } else if (previous && !options.yes) {
      throw new CLIError(
        "The configuration already exists. Review the changes above and rerun with --yes to save them.",
        exitCodes.usage
      );
    }

    await context.output.progress(
      "Saving project configuration",
      () => writeProjectConfig(file, config, original, signal),
      "Project configuration saved"
    );
  }

  await context.output.success(
    unchanged ? "Project configuration is up to date." : "Project initialized."
  );

  const generate =
    options.generate ??
    (interactive &&
      (await context.prompt((prompt) =>
        confirm({
          ...prompt,
          message: "Generate the configured types file now?",
          initialValue: false
        })
      )));
  const generation = generate
    ? await executeTypes(
        {
          ...scopedContext,
          config: {
            ...scopedContext.config,
            configPath: file,
            types: { ...types, output: path.resolve(path.dirname(file), types.output) }
          }
        },
        {},
        false
      )
    : undefined;

  await context.output.json({
    configured: true,
    changed: !unchanged,
    configPath: file,
    baseURL: config.baseURL,
    workspaceID,
    ...(generation ? { generation } : {})
  });
};

export { init };
