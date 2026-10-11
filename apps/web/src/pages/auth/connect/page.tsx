import { Button, Card, Checkbox, IconButton, Select, Tooltip } from "@andesine/components";
import { Title } from "@solidjs/meta";
import { createAsync, query, useLocation, useSearchParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { createSignal, Match, Show, Switch, type Component } from "solid-js";
import { useNotify } from "#web/context/notifications";
import { authClient, client } from "#web/lib/api";
import { appendRedirectTo } from "#web/lib/navigation";

interface PublicClient {
  client_id: string;
  client_name?: string;
}
interface ConsentResult {
  url?: string;
}
interface MCPResource {
  /** Set for a workspace's MCP URL; the fixed URL lets the person pick the workspace. */
  workspaceID?: string;
}

const WRITE_SCOPE = "andesine:write";

const consentSessionQuery = query(async () => {
  const result = await authClient.getSession();

  if (result.error) throw new Error("Could not load your account");

  return result.data;
}, "consent-session");
const consentClientQuery = query(async (clientID: string) => {
  const { data } = await authClient.$fetch<PublicClient>("/oauth2/public-client", {
    query: { client_id: clientID }
  });

  return data ?? null;
}, "consent-client");
const consentWorkspacesQuery = query(() => client.workspaces.list(), "consent-workspaces");
const readParam = (value: string | string[] | undefined): string => {
  return (Array.isArray(value) ? value[0] : value) ?? "";
};
// The API URL can have a path prefix, so only the end of the path is matched.
const parseMCPResource = (resource: string): MCPResource | null => {
  try {
    const match = /\/mcp(?:\/([^/]+))?$/.exec(new URL(resource).pathname);

    return match ? { workspaceID: match[1] } : null;
  } catch {
    return null;
  }
};

/** Consent for an OAuth client, such as an MCP connector, to access one workspace. */
const ConnectPage: Component = () => {
  const notify = useNotify();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const clientID = () => readParam(searchParams.client_id);
  const scopes = () => readParam(searchParams.scope).split(" ").filter(Boolean);
  const [allowChanges, setAllowChanges] = createSignal(true);
  const [pickedWorkspaceID, setPickedWorkspaceID] = createSignal<string>();
  const session = createAsync(() => consentSessionQuery(), { deferStream: true });
  const oauthClient = createAsync(() => consentClientQuery(clientID()), { deferStream: true });
  const workspaces = createAsync(() => consentWorkspacesQuery(), { deferStream: true });
  const consentMutation = createMutation(() => ({
    mutationFn: async (accept: boolean) => {
      const requestedScopes = scopes().filter(
        (scope) => accept && (allowChanges() || scope !== WRITE_SCOPE)
      );
      const { data, error } = await authClient.$fetch<ConsentResult>("/oauth2/consent", {
        method: "POST",
        body: {
          accept,
          ...(accept && { scope: requestedScopes.join(" "), workspace_id: workspace()?.id }),
          oauth_query: window.location.search.slice(1)
        }
      });

      if (error || !data?.url) throw new Error(error?.message || "Could not complete the request");

      return data.url;
    },
    retry: false
  }));
  const resource = () => parseMCPResource(readParam(searchParams.resource));
  const canPick = () => resource() !== null && !resource()?.workspaceID;
  const workspace = () => {
    const workspaceID = resource()?.workspaceID ?? pickedWorkspaceID();

    return workspaceID
      ? workspaces()?.find(({ id }) => id === workspaceID)
      : canPick()
        ? workspaces()?.[0]
        : undefined;
  };
  const clientName = () => oauthClient()?.client_name || "An application";
  const accountLabel = () => {
    const user = session()?.user;

    return user?.name ? `${user.name} (${user.email})` : user?.email;
  };
  const requestsChanges = () => scopes().includes(WRITE_SCOPE);
  const validRequest = () => Boolean(clientID() && resource() && searchParams.sig);
  const busy = () => consentMutation.isPending;
  const returnPath = () => `/auth/connect${location.search}`;
  const signInLink = () => appendRedirectTo("/auth/sign-in", returnPath(), true);

  const respond = async (accept: boolean) => {
    if (busy()) return;

    try {
      window.location.assign(await consentMutation.mutateAsync(accept));
    } catch (error) {
      notify({
        type: "error",
        text: "Request not completed",
        description:
          error instanceof Error
            ? `${error.message}. Start the connection again from the application.`
            : "Start the connection again from the application."
      });
    }
  };

  return (
    <div class="flex flex-col">
      <Title>Connect {clientName()} | Andesine</Title>
      <Switch>
        <Match when={!validRequest() || oauthClient() === null}>
          <h1 class="text-2xl font-semibold">Request not valid</h1>
          <p class="text-sm leading-5 text-gray-400 mt-2">
            This connection request is incomplete or the application is unknown. Start the
            connection again from the application.
          </p>
        </Match>
        <Match when={workspaces() && !workspace()}>
          <h1 class="text-2xl font-semibold">Workspace not available</h1>
          <p class="text-sm leading-5 text-gray-400 mt-2">
            {session()?.user.email} isn't a member of the workspace that {clientName()} wants to
            access. Sign in with another account, or check the server URL in the application.
          </p>
          <Button link={signInLink()} size="medium" class="w-full mt-4">
            Change account
          </Button>
        </Match>
        <Match when={workspace()}>
          {(target) => (
            <>
              <h1 class="text-2xl font-semibold">Connect {clientName()}</h1>
              <div class="flex flex-col border-b border-gray-200 pb-3 text-gray-400 leading-5 text-sm">
                {clientName()} wants to access the workspace:
                <Card
                  color="soft"
                  class="mt-2 rounded-lg flex items-center gap-2 pt-1 pb-1.5 px-3 border-0 min-h-12"
                >
                  <Show when={target().logo}>
                    {(logo) => (
                      <img
                        src={logo()}
                        alt={`${target().name} logo`}
                        class="h-8 w-8 shrink-0 rounded-md object-contain"
                      />
                    )}
                  </Show>
                  <div class="flex min-w-0 flex-col justify-center">
                    <span class="text-sm leading-5 font-medium text-gray-900 line-clamp-1">
                      {target().name}
                    </span>
                    <span class="text-xs leading-none text-gray-500 line-clamp-1">
                      {accountLabel()}
                    </span>
                  </div>
                </Card>
                <Show when={canPick() && (workspaces()?.length ?? 0) > 1}>
                  <Select
                    class="mt-2"
                    title="Workspace"
                    disabled={busy()}
                    value={target().id}
                    setValue={(value) => value && setPickedWorkspaceID(value)}
                    options={(workspaces() ?? []).map(({ id, name }) => ({
                      label: name,
                      value: id
                    }))}
                  />
                </Show>
              </div>
              <Show when={requestsChanges()}>
                <label class="flex items-start gap-2 mt-3 cursor-pointer text-sm leading-5 text-gray-400">
                  <Checkbox
                    size="small"
                    checked={allowChanges()}
                    setChecked={setAllowChanges}
                    disabled={busy()}
                  />
                  <span>
                    <span class="font-medium text-gray-600">Enable write access:</span> create,
                    edit, move, publish, and delete content.
                  </span>
                </label>
              </Show>
              <div class="flex items-center gap-2 mt-3.5">
                <Tooltip content="Deny access">
                  <IconButton
                    aria-label="Deny access"
                    icon="i-lucide:x"
                    size="medium"
                    disabled={busy()}
                    loading={busy() && consentMutation.variables === false}
                    onClick={() => respond(false)}
                  />
                </Tooltip>
                <Button
                  class="flex-1"
                  size="medium"
                  disabled={busy()}
                  loading={busy() && consentMutation.variables === true}
                  onClick={() => respond(true)}
                >
                  Approve
                </Button>
              </div>
              <div class="flex flex-col items-start text-sm text-gray-400 mt-4">
                <span>Want to use another account?</span>
                <div class="inline-flex -mt-1">
                  <IconButton
                    icon="i-lucide:arrow-right-left"
                    iconProps={{ class: "w-3.5 h-3.5" }}
                    variant="link"
                    label={() => <span>Change account</span>}
                    disabled={busy()}
                    link={signInLink()}
                    class="flex-row-reverse gap-1 inline-flex font-medium px-0"
                  />
                </div>
              </div>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
};

export default ConnectPage;
