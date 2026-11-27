import { IconButton } from "@andesine/components";
import { Meta, Title } from "@solidjs/meta";
import { useNavigate, useParams } from "@solidjs/router";
import { ORPCError } from "@orpc/client";
import { type Component, createSignal, Match, onMount, Switch } from "solid-js";
import { authClient, createVisitorClient } from "#web/lib/api";
import { appendRedirectTo } from "#web/lib/navigation";
import { AccountOptions } from "./account-options";
import { type VisitorUser } from "./visitor-menu";
import { EditorPaneMessage } from "../workspace/editor/editor-pane-states";
import {
  isAccessError,
  SharedEntry,
  type SharedEntryData,
  SharedEntryFrame,
  SharedEntrySkeleton
} from "./shared-entry";

interface ReadyShare {
  token: string;
  shared: SharedEntryData;
  user: VisitorUser | null;
}
interface ShareError {
  message: string;
  action: "sign-in" | "switch-account" | "retry";
}

const TOKEN_KEY_PREFIX = "andesine:share:";

const readToken = (code: string) => {
  try {
    return localStorage.getItem(`${TOKEN_KEY_PREFIX}${code}`) ?? undefined;
  } catch {
    return undefined;
  }
};
const writeToken = (code: string, token: string) => {
  try {
    localStorage.setItem(`${TOKEN_KEY_PREFIX}${code}`, token);
  } catch {
    // The visitor joins again on the next visit.
  }
};
const getShareError = (error: unknown): ShareError => {
  const code = error instanceof ORPCError ? error.code : "UNKNOWN";

  if (code === "UNAUTHORIZED") {
    return {
      message: "Sign in with the email address that the entry was shared with.",
      action: "sign-in"
    };
  }

  // A signed-in account with another email.
  if (code === "FORBIDDEN") {
    return { message: (error as ORPCError<string, unknown>).message, action: "switch-account" };
  }

  if (code === "NOT_FOUND") {
    return { message: "The share was removed or has expired.", action: "retry" };
  }

  if (code === "TOO_MANY_REQUESTS") {
    return { message: "Too many attempts. Try again later.", action: "retry" };
  }

  return { message: "The entry couldn't be opened. Try again.", action: "retry" };
};
const SharePage: Component = () => {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [ready, setReady] = createSignal<ReadyShare | null>(null);
  const [error, setError] = createSignal<ShareError | null>(null);
  const [userID, setUserID] = createSignal<string>();
  const signInLink = () => appendRedirectTo("/auth/sign-in", `/share/${params.code}`);
  // Anonymous visitors keep their token; signed-in people join as their account.
  const open = async () => {
    const { data: session } = await authClient.getSession().catch(() => ({ data: null }));
    const storedToken = readToken(params.code);
    const stored =
      storedToken && !session?.session
        ? await createVisitorClient(storedToken)
            .shares.current()
            .catch((error: unknown) => {
              // Other failures keep the token, so the visitor keeps their comments.
              if (isAccessError(error)) return null;

              throw error;
            })
        : null;

    const user = session?.user ?? null;

    setUserID(user?.id);

    if (storedToken && stored) return setReady({ token: storedToken, shared: stored, user });

    const joined = await createVisitorClient().shares.join({ code: params.code });

    if (joined.type === "member") {
      navigate(`/${joined.workspaceID}/${joined.entryID}`, { replace: true });
      return;
    }

    // Accounts join again on each visit; a kept token would outlast their sign-out.
    if (!user) writeToken(params.code, joined.token);

    setReady({
      token: joined.token,
      shared: await createVisitorClient(joined.token).shares.current(),
      user
    });
  };

  onMount(() => {
    open().catch((failure: unknown) => setError(getShareError(failure)));
  });

  return (
    <>
      {/* Share links are capabilities, so search engines shouldn't list them. */}
      <Meta name="robots" content="noindex" />
      <Switch
        fallback={
          <main class="h-full w-full">
            <Title>Shared entry | Andesine</Title>
            <SharedEntrySkeleton />
          </main>
        }
      >
        <Match when={ready()}>
          {(share) => (
            <main class="h-full w-full">
              <Title>{share().shared.entry.name} | Andesine</Title>
              <SharedEntry token={share().token} shared={share().shared} user={share().user} />
            </main>
          )}
        </Match>
        <Match when={error()}>
          {(failure) => (
            <main class="h-full w-full">
              <Title>Shared entry | Andesine</Title>
              <SharedEntryFrame>
                <EditorPaneMessage title="Couldn't open the entry" description={failure().message}>
                  <Switch
                    fallback={
                      <IconButton
                        icon="i-lucide:rotate-cw"
                        class="w-full gap-1"
                        iconProps={{ class: "h-5 w-5 text-gray-400" }}
                        text="base"
                        size="medium"
                        label="Try again"
                        onClick={() => window.location.reload()}
                      />
                    }
                  >
                    <Match when={failure().action === "switch-account" && userID()}>
                      {(id) => <AccountOptions userID={id()} />}
                    </Match>
                    <Match when={failure().action === "sign-in"}>
                      <IconButton
                        icon="i-lucide:log-in"
                        class="w-full gap-1"
                        iconProps={{ class: "h-5 w-5 text-gray-400" }}
                        text="base"
                        size="medium"
                        label="Go to sign in"
                        link={signInLink()}
                      />
                    </Match>
                  </Switch>
                </EditorPaneMessage>
              </SharedEntryFrame>
            </main>
          )}
        </Match>
      </Switch>
    </>
  );
};

export default SharePage;
