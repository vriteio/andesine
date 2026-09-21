import type { CommandContext } from "../context";
import { authenticatedClient, identity } from "./client";

/** Verify the selected credential online; output identity metadata only. */
const status = async (context: CommandContext): Promise<void> => {
  const { output } = context;

  await output.heading("Andesine · Authentication");

  const { account, source } = await output.progress(
    "Checking authentication",
    async () => {
      const { client, source } = await authenticatedClient(context);
      const account = await identity(client, context.signal);

      return { account, source };
    },
    "Authentication verified"
  );

  await output.note("Authenticated", {
    "Instance": context.config.baseURL,
    "Account": account.type === "key" ? undefined : account.user.email,
    "API key": account.type === "key" ? account.keyID : undefined,
    "Profile": source === "environment" ? undefined : context.config.profileName,
    "Credentials": source,
    "Workspace": account.type === "key" ? account.workspaceID : context.config.workspaceID
  });

  await context.output.json({
    authenticated: true,
    baseURL: context.config.baseURL,
    profile: source === "environment" ? null : context.config.profileName,
    credentialSource: source,
    account: account.type === "key" ? null : account.user,
    keyID: account.type === "key" ? account.keyID : undefined,
    workspaceID: account.type === "key" ? account.workspaceID : (context.config.workspaceID ?? null)
  });
};

export { status };
