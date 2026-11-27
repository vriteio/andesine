import { Card, IconButton, Tooltip } from "@andesine/components";
import clsx from "clsx";
import {
  Editor,
  type EditorComments,
  type EditorImages,
  type EditorSuggesting
} from "@andesine/editor";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  type ParentComponent,
  onCleanup,
  onMount,
  Show
} from "solid-js";
import { createActiveElementViews } from "#web/components/extensions/element-views";
import { runExtensions } from "#web/components/extensions/extension-loader";
import { ORPCError } from "@orpc/client";
import { useNotify } from "#web/context/notifications";
import { config, createVisitorClient } from "#web/lib/api";
import { formatRelativeTime } from "#web/lib/primitives";
import { extensionsLoading } from "#web/lib/extensions";
import { getOwnSuggestions, mapThread, toSuggestionInput } from "../workspace/comments/mapping";
import { EditingModeMenu } from "../workspace/editing-mode-menu";
import {
  ELEMENT_VIEWS_SETTLE_TIME,
  ELEMENT_VIEWS_TIMEOUT
} from "../workspace/editor/collaborative-editor-pane";
import { VisitorMenu, type VisitorUser } from "./visitor-menu";
import { getCollaborationUser } from "../workspace/editor/editor-collaboration";
import {
  EDITOR_CONTENT_PADDING,
  EditorContentSkeleton,
  EditorPaneMessage
} from "../workspace/editor/editor-pane-states";

interface SharedEntryProps {
  token: string;
  shared: SharedEntryData;
  user: VisitorUser | null;
}

type VisitorClient = ReturnType<typeof createVisitorClient>;
type SharedEntryData = Awaited<ReturnType<VisitorClient["shares"]["current"]>>;
type CommentThread = Awaited<ReturnType<VisitorClient["comments"]["list"]>>["data"][number];
type SharedExtensions = Awaited<ReturnType<VisitorClient["shares"]["extensions"]>>;

// Before the comment events reconnect after their stream ends.
const STREAM_RETRY_DELAY = 5000;
// The longest wait for the extensions to start; a slow one doesn't hide the entry.
const EXTENSIONS_TIMEOUT = 2000;
// Without a first sync by then, e.g. with WebSockets blocked, the page shows the failure.
const EDITOR_LOAD_TIMEOUT = 15000;

const toMemberNames = (members: SharedEntryData["members"]) => {
  return new Map(members.map(({ id, name }) => [id, name]));
};
/** The visitor token stopped working, as the share was removed or expired. */
const isAccessError = (error: unknown) => {
  return error instanceof ORPCError && error.code === "UNAUTHORIZED";
};
/** As the workspace's content area. */
const SharedEntryFrame: ParentComponent = (props) => (
  <div class="flex h-full w-full flex-col md:p-3">
    <Card
      class="z-1 @container/editor relative flex min-h-0 w-full flex-1 flex-col overflow-hidden p-0 max-md:!border-0 max-md:!rounded-none max-md:!shadow-none"
      shade
    >
      {props.children}
    </Card>
  </div>
);
const SharedEntrySkeleton: Component = () => (
  <SharedEntryFrame>
    <div class="h-11 w-full shrink-0" />
    <div class="relative flex min-h-0 w-full flex-1 overflow-hidden">
      <EditorContentSkeleton class={EDITOR_CONTENT_PADDING} />
    </div>
  </SharedEntryFrame>
);
const SharedEntry: Component<SharedEntryProps> = (props) => {
  const notify = useNotify();
  const client = createVisitorClient(props.token);
  const [extensions, setExtensions] = createSignal<SharedExtensions>();
  const [threads, setThreads] = createSignal<CommentThread[]>([]);
  const [loaded, setLoaded] = createSignal(false);
  const [access, setAccess] = createSignal(props.shared.share.access);
  const [suggesting, setSuggesting] = createSignal(props.shared.share.access === "comment");
  const [suggestionsShown, setSuggestionsShown] = createSignal(true);
  const [savedName, setSavedName] = createSignal(props.shared.visitor.name);
  // Created after the first sync, which the skeleton covers until then.
  const [editorReady, setEditorReady] = createSignal(false);
  // The editor unmounts, so it doesn't reconnect.
  const [accessEnded, setAccessEnded] = createSignal(false);
  const [extensionsListed, setExtensionsListed] = createSignal(false);
  const [extensionsWaited, setExtensionsWaited] = createSignal(false);
  const [viewsRendered, setViewsRendered] = createSignal(false);
  const [loadFailed, setLoadFailed] = createSignal(false);
  const [memberNames, setMemberNames] = createSignal(toMemberNames(props.shared.members));
  // Each unknown author's name is requested once.
  const requestedAuthorIDs = new Set<string>();
  // The thread changes made while the latest load runs, kept over its result.
  let loadChanges: Map<string, CommentThread | null> | undefined;
  // Read only: visitors view the entry's images and can't add any.
  const images: EditorImages = {
    enabled: () => false,
    async load(assetID, signal) {
      const details = await client.shares.getAsset({ assetID }, { signal });
      const file = details.files.find(({ variant }) => variant === "display");

      if (details.status !== "ready" || !file) throw new Error("Image is not available");

      const response = await fetch(file.url, { signal, credentials: "omit", cache: "no-store" });

      if (!response.ok) throw new Error("Image download failed. Try again.");

      return response.blob();
    },
    upload: async () => null,
    uploadURL: async () => null,
    attach: async () => undefined
  };
  const elementViews = config.PUBLIC_EXTENSIONS_ENABLED
    ? createActiveElementViews(() => extensions()?.activeViews)
    : undefined;
  const canComment = () => access() === "comment";
  const contentShown = () => editorReady() && viewsRendered();
  const visitorID = props.shared.visitor.id;
  const isOwn = ({ visitor }: Pick<CommentThread, "visitor">) => visitor?.id === visitorID;
  // Members who comment while the page is open aren't in the loaded names yet.
  const loadMemberNames = (loaded: CommentThread[]) => {
    const unknownIDs = new Set(
      loaded.flatMap(({ comments }) => comments.map(({ authorID }) => authorID ?? ""))
    );

    for (const id of unknownIDs) {
      if (!id || memberNames().has(id) || requestedAuthorIDs.has(id)) unknownIDs.delete(id);
    }

    if (!unknownIDs.size) return;

    unknownIDs.forEach((id) => requestedAuthorIDs.add(id));
    client.shares.current().then(
      (shared) => {
        setMemberNames((names) => new Map([...names, ...toMemberNames(shared.members)]));
      },
      (error: unknown) => {
        unknownIDs.forEach((id) => requestedAuthorIDs.delete(id));
        console.error(error);
      }
    );
  };
  // After a member changes the share's access, e.g. from comment to view.
  const loadAccess = () => {
    client.shares.current().then(
      (shared) => setAccess(shared.share.access),
      (error: unknown) => console.error(error)
    );
  };
  const putThread = (thread: CommentThread) => {
    loadChanges?.set(thread.id, thread);
    loadMemberNames([thread]);
    setThreads((current) => {
      const isNew = !current.some(({ id }) => id === thread.id);

      return isNew
        ? [...current, thread]
        : current.map((existing) => (existing.id === thread.id ? thread : existing));
    });

    return thread;
  };
  const removeThread = (threadID: string) => {
    loadChanges?.set(threadID, null);
    setThreads((current) => current.filter(({ id }) => id !== threadID));
  };
  const loadThreads = async () => {
    const changes = new Map<string, CommentThread | null>();
    const loadedThreads: CommentThread[] = [];
    let cursor: string | undefined;

    loadChanges = changes;

    try {
      do {
        const page = await client.comments.list({ entryID: props.shared.entry.id, cursor });

        loadedThreads.push(...page.data);
        cursor = page.pagination.nextCursor ?? undefined;
      } while (cursor);

      // A newer load started meanwhile, so this result is out of date.
      if (loadChanges !== changes) return;

      // Keeps the changes made while it loaded, e.g. a comment just added.
      const merged = new Map(loadedThreads.map((thread) => [thread.id, thread]));

      for (const [id, thread] of changes) {
        if (thread) merged.set(id, thread);
        else merged.delete(id);
      }

      setThreads([...merged.values()]);
      loadMemberNames(loadedThreads);
    } catch (error) {
      if (isAccessError(error)) setAccessEnded(true);
      else console.error(error);
    } finally {
      setLoaded(true);
    }
  };
  // Suggestion saves retry in the editor, so they only end the access here.
  const checkAccess = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (failure) {
      if (isAccessError(failure)) setAccessEnded(true);
      if (failure instanceof ORPCError && failure.code === "FORBIDDEN") loadAccess();

      throw failure;
    }
  };
  const run = async <T,>(action: () => Promise<T>, error: string): Promise<T> => {
    try {
      return await checkAccess(action);
    } catch (failure) {
      if (!isAccessError(failure)) notify({ type: "error", text: error });

      void loadThreads();
      throw failure;
    }
  };
  const rename = async (name: string | null) => {
    await run(() => client.shares.rename({ name }), "Failed to save the name");
    setSavedName(name);
    void loadThreads();
  };
  const comments = createMemo((): EditorComments => ({
    threads: threads().map((thread) => {
      return mapThread(thread, {
        getMemberName: (memberID) => memberNames().get(memberID ?? "") ?? "Member",
        isOwn,
        canResolve: false
      });
    }),
    authorName: savedName() ?? "Anonymous",
    canComment: canComment(),
    canResolve: false,
    canApply: false,
    showSuggestions: suggestionsShown(),
    create: async (input) => {
      const thread = await run(
        () => client.comments.createThread({ ...input, entryID: props.shared.entry.id }),
        "Failed to add the comment"
      );

      putThread(thread);
    },
    reply: (threadID, content) => {
      return run(() => client.comments.reply({ threadID, content }), "Failed to reply").then(
        putThread
      );
    },
    update: (id, content) => {
      return run(
        () => client.comments.update({ id, content }),
        "Failed to update the comment"
      ).then(putThread);
    },
    remove: async (id) => {
      await run(() => client.comments.delete({ id }), "Failed to delete the comment");
      await loadThreads();
    },
    resolve: async () => undefined,
    reopen: async () => undefined,
    apply: async () => undefined,
    setApplied: async () => undefined,
    formatTime: formatRelativeTime
  }));
  const ownSuggestions = createMemo(() => getOwnSuggestions(threads(), isOwn));
  const editorSuggesting = createMemo((): EditorSuggesting | undefined => {
    const entryID = props.shared.entry.id;

    if (!canComment() || !loaded() || !suggesting()) return undefined;

    return {
      own: ownSuggestions(),
      create: async (patch) => {
        const thread = await checkAccess(() => {
          return client.comments.suggest({ ...toSuggestionInput(patch), entryID });
        });

        return putThread(thread).id;
      },
      update: async (id, patch) => {
        const thread = await checkAccess(() => {
          return client.comments.updateSuggestion({ id, ...toSuggestionInput(patch) });
        });

        putThread(thread);
      },
      remove: async (threadID) => {
        const firstID = threads().find(({ id }) => id === threadID)?.comments[0]?.id;

        if (!firstID) throw new Error("The suggestion isn't loaded yet");

        await checkAccess(() => client.comments.delete({ id: firstID }));
        removeThread(threadID);
      }
    };
  });

  if (config.PUBLIC_EXTENSIONS_ENABLED) {
    runExtensions(
      () => extensions()?.runtime,
      () => extensions()?.configurations
    );
  }

  // As in the workspace, the content shows with its element views' first render.
  createEffect(() => {
    if (!editorReady() || extensionsWaited()) return;

    const timeout = setTimeout(() => setExtensionsWaited(true), EXTENSIONS_TIMEOUT);

    onCleanup(() => clearTimeout(timeout));
  });
  createEffect(() => {
    const extensionsStarted =
      !config.PUBLIC_EXTENSIONS_ENABLED || (extensionsListed() && !extensionsLoading());
    const isWaiting =
      !editorReady() || viewsRendered() || (!extensionsStarted && !extensionsWaited());

    if (isWaiting) return;

    const rendering = elementViews?.rendering();
    const delay = rendering ? ELEMENT_VIEWS_TIMEOUT : ELEMENT_VIEWS_SETTLE_TIME;
    const timeout = setTimeout(() => setViewsRendered(true), delay);

    onCleanup(() => clearTimeout(timeout));
  });
  onMount(() => {
    const events = new AbortController();
    // Reconnects, e.g. after a restart, until the share ends.
    const listen = async () => {
      while (!events.signal.aborted && !accessEnded()) {
        try {
          for await (const event of await client.shares.events(undefined, {
            signal: events.signal
          })) {
            if (event.action === "comment-thread:update") putThread(event.data);
            if (event.action === "comment-thread:delete") removeThread(event.data.id);
          }
        } catch (error) {
          if (isAccessError(error)) setAccessEnded(true);
          else if (!events.signal.aborted) console.error(error);
        }

        if (events.signal.aborted || accessEnded()) return;

        await new Promise((resolve) => setTimeout(resolve, STREAM_RETRY_DELAY));
        // Events are missed meanwhile.
        void loadThreads();
      }
    };
    // Events are missed while the page is hidden or offline.
    const reload = () => {
      if (document.visibilityState === "visible") void loadThreads();
    };

    const loadTimeout = setTimeout(() => setLoadFailed(!editorReady()), EDITOR_LOAD_TIMEOUT);

    void loadThreads();
    void listen();

    if (config.PUBLIC_EXTENSIONS_ENABLED) {
      client.shares
        .extensions()
        .then(setExtensions, (error: unknown) => console.error(error))
        .finally(() => setExtensionsListed(true));
    }
    document.addEventListener("visibilitychange", reload);
    onCleanup(() => {
      clearTimeout(loadTimeout);
      events.abort();
      document.removeEventListener("visibilitychange", reload);
    });
  });

  return (
    <SharedEntryFrame>
      <header class="flex h-11 w-full shrink-0 items-center gap-1 p-2">
        <span class="mr-4 inline-flex min-w-0 flex-1 items-center text-base font-medium leading-[1]">
          <Tooltip content={props.shared.workspace.name} placement="bottom" fixed>
            <Show
              when={props.shared.workspace.logo}
              fallback={
                <IconButton
                  icon="i-lucide:hexagon"
                  variant="ghost"
                  badge
                  aria-label={props.shared.workspace.name}
                />
              }
            >
              {(logo) => (
                <span class="flex h-7 w-7 shrink-0 items-center justify-center">
                  <img
                    src={logo()}
                    alt={props.shared.workspace.name}
                    class="h-4 w-4 rounded object-contain"
                  />
                </span>
              )}
            </Show>
          </Tooltip>
          <span class="flex h-4 w-2 items-center justify-center text-gray-200">/</span>
          <span class="m-0.5 truncate p-0.5 text-sm" title={props.shared.entry.name}>
            {props.shared.entry.name}
          </span>
        </span>
        <Show when={canComment()}>
          <EditingModeMenu
            suggesting={suggesting()}
            canEdit={false}
            compact
            suggestionsShown={suggestionsShown()}
            setSuggesting={setSuggesting}
            setSuggestionsShown={setSuggestionsShown}
          />
        </Show>
        <VisitorMenu
          name={savedName()}
          user={props.user}
          canRename={canComment()}
          onRename={rename}
        />
      </header>
      <Show
        when={!accessEnded()}
        fallback={
          <EditorPaneMessage
            title="Access ended"
            description="The share was removed or has expired."
          />
        }
      >
        <Show when={loadFailed() && !editorReady()}>
          <EditorPaneMessage
            title="Couldn't load the entry"
            description="The connection to the server failed."
          >
            <IconButton
              icon="i-lucide:rotate-cw"
              class="w-full gap-1"
              iconProps={{ class: "h-5 w-5 text-gray-400" }}
              text="base"
              size="medium"
              label="Try again"
              onClick={() => window.location.reload()}
            />
          </EditorPaneMessage>
        </Show>
        <div
          class={clsx(
            "relative flex min-h-0 w-full flex-1 overflow-hidden",
            loadFailed() && !editorReady() && "hidden"
          )}
        >
          <Show when={!contentShown()}>
            <EditorContentSkeleton class={EDITOR_CONTENT_PADDING} />
          </Show>
          <div class="h-full w-full md:px-1">
            <Editor
              class={EDITOR_CONTENT_PADDING}
              doc={props.shared.entry.id}
              url={`${config.PUBLIC_WS_API_URL}/collab`}
              token={props.token}
              elementViews={elementViews}
              images={images}
              // After the first sync, so the suggesting fork starts from the loaded entry.
              beforeProviderAttach={() => ({ renderImmediately: false })}
              editable={Boolean(editorSuggesting())}
              comments={comments()}
              suggesting={editorSuggesting()}
              collaborationUser={getCollaborationUser({ id: visitorID, name: savedName() })}
              notify={(type, text) => notify({ type, text })}
              onEditor={() => {
                setEditorReady(true);

                return () => setEditorReady(false);
              }}
              onProvider={(provider) => {
                const end = () => setAccessEnded(true);
                const close = ({ event }: { event: CloseEvent }) => {
                  if (event.code === 4401 || event.code === 4403) end();
                };

                provider.on("authenticationFailed", end);
                provider.on("close", close);

                return () => {
                  provider.off("authenticationFailed", end);
                  provider.off("close", close);
                };
              }}
            />
          </div>
        </div>
      </Show>
    </SharedEntryFrame>
  );
};

export { isAccessError, SharedEntry, SharedEntryFrame, SharedEntrySkeleton };
export type { SharedEntryData };
