import type { CommandContext } from "../context";
import { authenticatedClient, identity } from "./client";

/** Verify the selected credential online; output identity metadata only. */
const status = async (context: CommandContext): Promise<void> => {
  const { output } = context;

  await output.heading("Andesine · Authentication");

  const { account, source, workspaces } = await output.progress(
    "Checking authentication",
    async () => {
      const { client, source } = await authenticatedClient(context);
      const account = await identity(client, context.signal);
      // A user's workspaces, to flag a selected one they can't use, e.g. after a reset.
      const workspaces =
        account.type === "key"
          ? null
          : await client.workspaces.list(undefined, { signal: context.signal });

      return { account, source, workspaces };
    },
    "Authentication verified"
  );
  const workspaceID = context.config.workspaceID;
  const isUnavailable = Boolean(
    workspaceID && workspaces && !workspaces.some(({ id }) => id === workspaceID)
  );

  await output.note("Authenticated", {
    "Instance": context.config.baseURL,
    "Account": account.type === "key" ? undefined : account.user.email,
    "API key": account.type === "key" ? account.keyID : undefined,
    "Profile": source === "environment" ? undefined : context.config.profileName,
    "Credentials": source,
    "Workspace": account.type === "key" ? account.workspaceID : context.config.workspaceID
  });

  if (isUnavailable) {
    await output.warning(
      `The workspace ${workspaceID} is not available to this account. Run auth login again, or select one with --workspace.`
    );
  }

  await context.output.json({
    authenticated: true,
    baseURL: context.config.baseURL,
    profile: source === "environment" ? null : context.config.profileName,
    credentialSource: source,
    account: account.type === "key" ? null : account.user,
    keyID: account.type === "key" ? account.keyID : undefined,
    workspaceID: account.type === "key" ? account.workspaceID : (workspaceID ?? null),
    ...(isUnavailable && { workspaceAvailable: false })
  });
};

export { status };
