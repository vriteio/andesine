import { Button, Card, IconButton, OTPInput, Tooltip } from "@andesine/components";
import { Title } from "@solidjs/meta";
import { createAsync, query, useSearchParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { createEffect, createSignal, on, onCleanup, Show, type Component } from "solid-js";
import { useNotify } from "#web/context/notifications";
import { authClient, client } from "#web/lib/api";
import { appendRedirectTo } from "#web/lib/navigation";
import { toUserID } from "#web/lib/primitives";
import { getRequestError, messages, normalizeUserCode, type DeviceRequestState } from "./state";

const deviceSessionQuery = query(async () => {
  const result = await authClient.getSession();

  if (result.error) throw new Error("Could not load your account");

  return result.data;
}, "device-session");

const DevicePage: Component = () => {
  const notify = useNotify();
  const [searchParams] = useSearchParams();
  const codeFromURL = () => {
    const value = searchParams.user_code;

    return normalizeUserCode(Array.isArray(value) ? value[0] || "" : value || "");
  };
  const [userCode, setUserCode] = createSignal(codeFromURL());
  const [state, setState] = createSignal<DeviceRequestState>();
  const session = createAsync(() => deviceSessionQuery(), { deferStream: true });
  const respondMutation = createMutation(() => ({
    mutationFn: (input: Parameters<typeof client.auth.respondToDeviceRequest>[0]) =>
      client.auth.respondToDeviceRequest(input),
    retry: false
  }));
  const busy = () => respondMutation.isPending;
  const completed = () => state() === "approved" || state() === "denied";
  const completionMessage = () => (state() === "denied" ? messages.denied : messages.approved);
  const normalizedCode = () => normalizeUserCode(userCode());
  const validCode = () => /^[A-HJ-NP-Z2-9]{8}$/.test(normalizedCode());
  const returnPath = () => `/auth/device?${new URLSearchParams({ user_code: normalizedCode() })}`;
  const signInLink = () => appendRedirectTo("/auth/sign-in", returnPath(), true);

  let revision = 0;
  let closeTabTimeout: number | undefined;

  const closeTab = () => {
    window.close();
    window.clearTimeout(closeTabTimeout);
    closeTabTimeout = window.setTimeout(() => {
      if (!window.closed) {
        notify({
          type: "info",
          text: "Close this tab manually",
          description: "Your browser did not allow this page to close the tab."
        });
      }
    }, 300);
  };
  const reset = () => {
    revision += 1;
    setState(undefined);
  };
  const respond = async (decision: "approve" | "deny") => {
    const current = session();
    const currentRevision = revision;

    if (busy() || !validCode() || completed() || !current) return;

    setState(undefined);

    try {
      const { state: requestState } = await respondMutation.mutateAsync({
        userCode: normalizedCode(),
        userID: toUserID(current.user.id),
        decision
      });

      if (currentRevision !== revision) return;

      setState(requestState);

      const showNotification =
        requestState !== "approved" && requestState !== "denied" && requestState !== "pending";

      if (showNotification) {
        const type = requestState === "processed" ? "info" : "error";

        notify({ type, ...messages[requestState] });
      }
    } catch (error) {
      if (currentRevision !== revision) return;

      // The server checks the request status again before applying another decision.
      setState(undefined);
      notify({ type: "error", ...getRequestError(error) });
    }
  };

  createEffect(
    on(
      codeFromURL,
      (value) => {
        reset();
        setUserCode(value);
      },
      { defer: true }
    )
  );
  onCleanup(() => {
    revision += 1;
    clearTimeout(closeTabTimeout);
  });

  return (
    <div class="flex flex-col">
      <Title>Authorize CLI | Andesine</Title>
      <Show
        when={!completed()}
        fallback={
          <div role="status" class="flex flex-col gap-2">
            <h1 class="text-2xl font-semibold">{completionMessage().text}</h1>
            <p class="text-sm leading-5 text-gray-400">{completionMessage().description}</p>
            <Button color="primary" class="w-full mt-1" onClick={closeTab}>
              Close tab
            </Button>
          </div>
        }
      >
        <h1 class="text-2xl font-semibold">Authorize CLI</h1>
        <div class="text-gray-400 leading-5 text-sm">
          <Show when={session()?.user} fallback="Sign in to authorize CLI access to your account.">
            {(user) => (
              <div class="flex flex-col border-b border-gray-200 pb-3">
                Enter the code from the terminal to authorize CLI access to all resources on
                account:
                <Card
                  color="soft"
                  class="mt-2 rounded-lg flex items-center gap-2 pt-1 pb-1.5 px-3 border-0 min-h-12"
                >
                  <Show when={user().image}>
                    {(image) => (
                      <img
                        src={image()}
                        alt={`${user().name || user().email} avatar`}
                        class="h-8 w-8 shrink-0 rounded-md object-contain"
                      />
                    )}
                  </Show>
                  <div class="flex min-w-0 flex-col justify-center">
                    <span class="text-sm leading-5 font-medium text-gray-900 line-clamp-1">
                      {user().name || user().email}
                    </span>
                    <Show when={user().name}>
                      <span class="text-xs leading-none text-gray-500 line-clamp-1">
                        {user().email}
                      </span>
                    </Show>
                  </div>
                </Card>
              </div>
            )}
          </Show>
        </div>
        <div class="flex flex-col mt-3 mb-4 gap-2.5">
          <OTPInput
            aria-label="Code from your terminal"
            controlClass="gap-1"
            length={8}
            type="alphanumeric"
            value={userCode()}
            sanitizeValue={normalizeUserCode}
            setValue={(value) => {
              reset();
              setUserCode(normalizeUserCode(value));
            }}
            disabled={busy()}
            onEnter={() => respond("approve")}
          />
          <Show
            when={session()}
            fallback={
              <Button link={signInLink()} color="primary" class="w-full mt-1">
                Sign in to continue
              </Button>
            }
          >
            <div class="flex items-center gap-2 mt-1">
              <Tooltip content="Deny access">
                <IconButton
                  aria-label="Deny access"
                  icon="i-lucide:x"
                  variant="outlined"
                  color="contrast"
                  text="soft"
                  disabled={!validCode() || busy()}
                  loading={
                    respondMutation.isPending && respondMutation.variables?.decision === "deny"
                  }
                  onClick={() => respond("deny")}
                />
              </Tooltip>
              <Button
                class="flex-1"
                color="primary"
                disabled={!validCode() || busy()}
                loading={
                  respondMutation.isPending && respondMutation.variables?.decision === "approve"
                }
                onClick={() => respond("approve")}
              >
                Approve
              </Button>
            </div>
          </Show>
        </div>
        <Show when={session()}>
          <div class="flex flex-col items-start text-sm text-gray-400">
            <span>Want to use another account?</span>
            <div class="inline-flex -mt-1">
              <IconButton
                icon="i-lucide:arrow-right-left"
                iconProps={{ class: "w-3.5 h-3.5" }}
                variant="text"
                text="primary"
                color="primary"
                size="small"
                label={() => <span>Change account</span>}
                disabled={busy()}
                link={signInLink()}
                hover="underline"
                class="flex-row-reverse gap-1 inline-flex font-medium px-0"
              />
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default DevicePage;
