import { createRef } from "@andesine/components";
import type {
  EditorCommentInput,
  EditorComments,
  EditorCommentsPanel,
  EditorCommentThread,
  EditorInstance,
  EditorOwnSuggestion,
  EditorSchemaField,
  EditorSuggesting,
  EditorSuggestionPatch
} from "@andesine/editor";
import {
  applySuggestion,
  getStaleStatus,
  isRejectedSave,
  rebaseSuggestion
} from "@andesine/editor";
import {
  createAsync,
  query,
  revalidate,
  useLocation,
  useNavigate,
  useParams
} from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { type CommentThread, commentThreadsQuery } from "#web/lib/data/comments";
import { membershipsQuery } from "#web/lib/data/people";
import { formatRelativeTime } from "#web/lib/primitives";
import {
  getSearchNavigationTarget,
  scrollToSearchTarget,
  type SearchNavigationTarget
} from "#web/lib/search-navigation";
import { schemaDraftQuery } from "#web/lib/data/schema-versions";
import { useComments } from "../comments/context";
import { DeleteThreadDialog } from "../comments/delete-thread-dialog";
import { CollaborativeEditorPane } from "../editor/collaborative-editor-pane";
import type { DocumentLoadState } from "../editor/document-load-state";

interface MappedThread {
  /** The loaded thread as JSON, to tell when it changes. */
  source: string;
  context: object;
  thread: EditorCommentThread;
}

type EditorDocument = EditorInstance["state"]["doc"];
type Member = Awaited<ReturnType<typeof membershipsQuery>>[number];

const LIVE_STATUS_DELAY = 300;
const LIVE_STATUS_MAX_DELAY = 2000;
// Failures in a row before a retried save shows its error.
const SILENT_SAVE_FAILURES = 3;

/** A title patch has no blocks, as the API takes one source. */
const toSuggestionInput = ({ blockIDs, after, blocks, title }: EditorSuggestionPatch) => {
  return title === undefined ? { blockIDs, after, blocks } : { blockIDs, after, title };
};
const EditorPane: Component = () => {
  const { currentWorkspace, currentSession, content, subscribeToUpdates } = useWorkspace();
  const notify = useNotify();
  const commentsPanel = useComments();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [editorInstance, setEditorInstance] = createRef<EditorInstance | null>(null);
  // The live content, for statuses before the threads reload.
  const [liveDocument, setLiveDocument] = createSignal<EditorDocument | null>(null);
  const [documentLoadState, setDocumentLoadState] = createRef<DocumentLoadState | null>(null);
  const [handledSearchTarget, setHandledSearchTarget] = createRef<SearchNavigationTarget | null>(
    null
  );
  const [openedEntryID, setOpenedEntryID] = createRef<string | null>(null);
  const [schemaFields, setSchemaFields] = createSignal<EditorSchemaField[]>();
  const [commentThreads, setCommentThreads] = createSignal<CommentThread[]>([]);
  const [members, setMembers] = createSignal(new Map<string, Member>());
  const [threadDeletion, setThreadDeletion] = createSignal<CommentThread | null>(null);
  const [deletingThread, setDeletingThread] = createSignal(false);
  const createCommentAction = <T, R extends CommentThread | void>(
    action: (input: T) => Promise<R>,
    error: string,
    // Suggestion saves retry instead, as a reload could drop threads they create meanwhile.
    isRetried = false
  ) => {
    const mutation = createMutation(() => ({
      mutationFn: action,
      onSuccess: (thread) => {
        if (isRetried) failedSaves = 0;

        // A deletion returns no thread.
        if (thread) {
          putCommentThread(thread);
        } else {
          void revalidateCommentThreads();
        }
      },
      // Others reload stale threads; retried saves notify only when rejected or failing repeatedly.
      onError: (failure) => {
        const isExpired = (failure as { status?: unknown } | null)?.status === 401;

        if (isRetried) failedSaves += 1;

        const isShown =
          !isRetried ||
          isRejectedSave(failure) ||
          failedSaves === (isExpired ? 1 : SILENT_SAVE_FAILURES);

        if (isShown) notify({ type: "error", text: error });

        if (!isRetried) void revalidateCommentThreads();
      }
    }));

    return (input: T) => mutation.mutateAsync(input);
  };
  const createThread = createCommentAction(
    (input: EditorCommentInput & { entryID: string }) => client.comments.createThread(input),
    "Failed to add the comment"
  );
  const reply = createCommentAction(
    (input: { threadID: string; content: string }) => client.comments.reply(input),
    "Failed to reply"
  );
  const updateComment = createCommentAction(
    (input: { id: string; content: string }) => client.comments.update(input),
    "Failed to update the comment"
  );
  const deleteComment = createCommentAction(
    (id: string) => client.comments.delete({ id }),
    "Failed to delete the comment"
  );
  const resolveThread = createCommentAction(
    (id: string) => client.comments.resolve({ id, resolved: true }),
    "Failed to resolve the thread"
  );
  const reopenThread = createCommentAction(
    (id: string) => client.comments.resolve({ id, resolved: false }),
    "Failed to reopen the thread"
  );
  // In the editor, so undo reverts it.
  const applyInEditor = createCommentAction(async (id: string) => {
    const editor = editorInstance();

    if (editor) await applySuggestion(editor, id);
  }, "Failed to apply the suggestion");
  const suggestChange = createCommentAction(
    (input: Parameters<typeof client.comments.suggest>[0]) => client.comments.suggest(input),
    "Failed to save the suggestion",
    true
  );
  const updateSuggestion = createCommentAction(
    (input: Parameters<typeof client.comments.updateSuggestion>[0]) => {
      return client.comments.updateSuggestion(input);
    },
    "Failed to save the suggestion",
    true
  );
  const selectedEntryID = () => params.slug;
  const availableEntryID = createMemo(() => {
    const entryID = selectedEntryID();

    if (!entryID) return null;

    return content.entriesCollection().findOne({ id: entryID })?.id ?? null;
  });
  const collectionID = createMemo(() => {
    return content.entries.get({ entryID: availableEntryID() || "" })?.collectionID || null;
  });
  const schemaDetails = createAsync(async () => {
    const currentCollectionID = collectionID();

    if (!currentCollectionID) return null;

    return {
      collectionID: currentCollectionID,
      ...(await schemaDraftQuery({ collectionID: currentCollectionID }))
    };
  });
  const revalidateCommentThreads = () => {
    const entryID = availableEntryID();

    return entryID ? revalidate(commentThreadsQuery.keyFor(entryID)) : undefined;
  };
  // The cache too, so it isn't stale on return.
  const changeCommentThreads = (
    entryID: string,
    change: (threads: CommentThread[]) => CommentThread[]
  ) => {
    if (entryID !== availableEntryID()) return;

    // A load in progress may miss the change.
    if (commentsPanel.loading()) {
      void revalidateCommentThreads();
      return;
    }

    const threads = change(commentThreads());

    setCommentThreads(threads);
    query.set(commentThreadsQuery.keyFor(entryID), threads);
  };
  const putCommentThread = (thread: CommentThread) => {
    changeCommentThreads(thread.entryID, (threads) => {
      const isNew = !threads.some(({ id }) => id === thread.id);

      return isNew
        ? [...threads, thread]
        : threads.map((current) => (current.id === thread.id ? thread : current));
    });
  };
  const loadedCommentThreads = createAsync(async () => {
    const entryID = availableEntryID();

    return entryID ? commentThreadsQuery(entryID) : [];
  });
  const loadedMembers = createAsync(() => membershipsQuery());
  const canResolve = () => {
    return !content.syncing() && content.canEntry(collectionID(), "comment:resolve");
  };
  const canComment = () => {
    return !content.syncing() && content.canEntry(collectionID(), "comment:create");
  };
  const canUpdate = () => content.canEntry(collectionID(), "entry:update");
  // Commenters only suggest, once their suggestions load; not syncing, which would rebuild the fork.
  const suggesting = () => {
    const canSuggest = content.canEntry(collectionID(), "comment:create");

    return canSuggest && !commentsPanel.loading() && (commentsPanel.suggesting() || !canUpdate());
  };
  const getAuthorName = (authorID: string | null) => {
    const profile = members().get(authorID ?? "")?.profile;

    return profile ? profile.name || profile.email : "Former member";
  };
  const ownMemberID = () => {
    const userID = currentSession()?.user.id;

    return [...members()].find(([, member]) => member.userID === userID)?.[0] ?? null;
  };
  const isOwnComment = (authorID: string | null) => Boolean(authorID) && authorID === ownMemberID();
  // Stable, so a new active thread doesn't recreate the comments.
  const editorCommentsPanel: EditorCommentsPanel = {
    get active() {
      return commentsPanel.active();
    },
    activate: (threadID) => {
      commentsPanel.activate(threadID, false);
      if (commentsPanel.mobile()) commentsPanel.setSheetOpened(true);
    },
    setOrder: commentsPanel.setOrder,
    setDraft: (draft) => {
      commentsPanel.setDraft(draft);
      if (draft && commentsPanel.mobile()) commentsPanel.setSheetOpened(true);
    }
  };
  // Keeps a changed status's thread, so unchanged statuses don't redraw the comments.
  const liveThreadCache = new WeakMap<EditorCommentThread, EditorCommentThread>();

  let failedSaves = 0;
  let mappedThreads = new Map<string, MappedThread>();

  const mapThread = (thread: CommentThread): EditorCommentThread => ({
    id: thread.id,
    anchor: thread.anchor,
    blockID: thread.blockID,
    resolved: thread.resolvedAt !== null,
    autoResolved: thread.autoResolved,
    quote: thread.quote,
    status: thread.status,
    suggestion: thread.suggestion && {
      ...thread.suggestion,
      applied: thread.appliedAt !== null
    },
    comments: thread.comments.map((comment) => ({
      id: comment.id,
      authorName: getAuthorName(comment.authorID),
      authorImage: members().get(comment.authorID ?? "")?.profile.image ?? undefined,
      content: comment.content,
      createdAt: comment.createdAt,
      editable: isOwnComment(comment.authorID),
      deletable: isOwnComment(comment.authorID) || canResolve()
    }))
  });
  // Unchanged threads keep their object, so they don't redraw.
  const mappingContext = createMemo(() => ({
    members: members(),
    ownMemberID: ownMemberID(),
    canResolve: canResolve()
  }));
  const editorThreads = createMemo(() => {
    const context = mappingContext();
    const next = new Map<string, MappedThread>();
    const threads = commentThreads().map((thread) => {
      const source = JSON.stringify(thread);
      const cached = mappedThreads.get(thread.id);
      const isUnchanged = cached?.source === source && cached.context === context;
      const mapped = isUnchanged ? cached.thread : mapThread(thread);

      next.set(thread.id, { source, context, thread: mapped });

      return mapped;
    });

    mappedThreads = next;

    return threads;
  });
  const liveThreads = createMemo(
    () => {
      const document = liveDocument();

      if (!document || suggesting()) return editorThreads();

      return editorThreads().map((thread) => {
        const { suggestion, resolved, autoResolved } = thread;
        const isSettled = !suggestion || suggestion.applied || (resolved && !autoResolved);

        if (isSettled) return thread;

        // Rebased on the live content; unappliable ones resolve, as on the server.
        const rebased = rebaseSuggestion(document, suggestion);
        const state = rebased
          ? { status: "active" as const, suggestion: rebased, resolved: false }
          : { status: getStaleStatus(document, suggestion), suggestion, resolved: true };
        const cached = liveThreadCache.get(thread);
        const isState = (current?: EditorCommentThread) => {
          const { status, suggestion, resolved } = current ?? {};

          return JSON.stringify({ status, suggestion, resolved }) === JSON.stringify(state);
        };
        const live = isState(thread) ? thread : isState(cached) ? cached! : { ...thread, ...state };

        liveThreadCache.set(thread, live);

        return live;
      });
    },
    undefined,
    { equals: (a, b) => a.length === b.length && a.every((thread, index) => thread === b[index]) }
  );
  const comments = createMemo((): EditorComments => ({
    threads: liveThreads(),
    authorName: getAuthorName(ownMemberID()),
    authorImage: members().get(ownMemberID() ?? "")?.profile.image ?? undefined,
    // Suggesting mode has no new comments, as its text isn't shared.
    canComment: canComment() && !suggesting(),
    canResolve: canResolve(),
    // Suggesting mode shows the fork, which applying would change.
    canApply: canResolve() && canUpdate() && !suggesting(),
    showSuggestions: commentsPanel.suggestionsShown() && !suggesting(),
    create: async (input) => {
      const entryID = availableEntryID();

      if (entryID) await createThread({ ...input, entryID });
    },
    reply: (threadID, content) => reply({ threadID, content }),
    update: (id, content) => updateComment({ id, content }),
    remove: async (id) => {
      const thread = commentThreads().find(({ comments }) => comments[0]?.id === id);

      if (thread) setThreadDeletion(thread);
      else await deleteComment(id);
    },
    resolve: resolveThread,
    reopen: reopenThread,
    apply: applyInEditor,
    setApplied: (id, applied) => client.comments.setApplied({ id, applied }),
    // The panel replaces the cards while open, and always on mobile.
    panel: commentsPanel.panelOpened() || commentsPanel.mobile() ? editorCommentsPanel : undefined,
    formatTime: formatRelativeTime
  }));
  const ownSuggestions = createMemo((): EditorOwnSuggestion[] => {
    const memberID = ownMemberID();
    const threads = [...commentThreads()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return threads.flatMap((thread) => {
      const { suggestion, comments } = thread;
      const isOwnOpen =
        suggestion && !thread.resolvedAt && !thread.appliedAt && thread.authorID === memberID;

      if (!isOwnOpen) return [];

      return [
        {
          ...suggestion,
          title: suggestion.title?.suggested,
          titleBase: suggestion.title?.base,
          threadID: thread.id,
          status: thread.status,
          discussed: comments.length > 1 || Boolean(comments[0]?.content.trim())
        }
      ];
    });
  });
  const editorSuggesting = createMemo((): EditorSuggesting | undefined => {
    // Fixed, so late saves don't reach another entry.
    const entryID = availableEntryID();

    if (!entryID || !suggesting()) return undefined;

    return {
      own: ownSuggestions(),
      create: async (patch) => (await suggestChange({ ...toSuggestionInput(patch), entryID })).id,
      update: (id, patch) => updateSuggestion({ id, ...toSuggestionInput(patch) }),
      remove: async (threadID) => {
        const firstID = commentThreads().find(({ id }) => id === threadID)?.comments[0]?.id;

        // The first comment's deletion deletes the thread; one not listed yet fails, to retry.
        if (!firstID) throw new Error("The suggestion isn't loaded yet");

        // Without reloading the list, which could drop threads its save creates meanwhile.
        await client.comments.delete({ id: firstID });
        changeCommentThreads(entryID, (threads) => threads.filter(({ id }) => id !== threadID));
      }
    };
  });
  const deleteThread = async () => {
    const thread = threadDeletion();

    if (!thread) return;

    setDeletingThread(true);

    try {
      await deleteComment(thread.comments[0]!.id);
      setThreadDeletion(null);
    } catch {
      // Reported by the action.
    } finally {
      setDeletingThread(false);
    }
  };
  const editable = createMemo(() => {
    const canEdit = canUpdate() || suggesting();

    return !content.syncing() && !content.hasActiveSchemaMigration(collectionID()) && canEdit;
  });
  const workspaceID = () => params.workspaceID || currentWorkspace()?.id || "unknown";
  // Actions depend on permissions, which load after the content.
  const loading = () => content.loading() || content.accessLoading();
  const emptyWorkspace = () => {
    return !loading() && !content.offline() && content.entriesCollection().find().count() === 0;
  };

  createEffect(() => commentsPanel.setComments(comments()));
  createEffect(
    on(availableEntryID, () => {
      commentsPanel.activate(null, false);
      commentsPanel.setOrder([]);
      setCommentThreads([]);
      commentsPanel.setLoading(true);
      commentsPanel.setSuggesting(false);
    })
  );
  onCleanup(() => commentsPanel.setComments(null));

  // In effects, so loading doesn't suspend the editor.
  createEffect(() => {
    const loaded = loadedCommentThreads();

    setCommentThreads(loaded ?? []);
    commentsPanel.setLoading(loaded === undefined);
  });
  createEffect(() => {
    setMembers(new Map((loadedMembers() ?? []).map((member) => [member.id, member])));
  });
  onCleanup(
    subscribeToUpdates((event) => {
      if (event.action === "comment-thread:update") putCommentThread(event.data);

      if (event.action === "comment-thread:delete") {
        const { id, entryID } = event.data;

        changeCommentThreads(entryID, (threads) => threads.filter((thread) => thread.id !== id));
      }
    })
  );
  // Events are missed while offline.
  createEffect(
    on(content.offline, (offline) => !offline && revalidateCommentThreads(), { defer: true })
  );

  // Read in an effect, so that loading the schema doesn't suspend the editor.
  // Until another collection's schema loads, the previous one is still returned.
  createEffect(() => {
    const details = schemaDetails();
    const current = details?.collectionID === collectionID();

    setSchemaFields(current ? details?.result?.effective?.definition.fields : undefined);
  });
  createEffect(
    on(
      () => content.hasActiveSchemaMigration(collectionID()),
      (active, wasActive) => {
        const currentCollectionID = collectionID();

        if (wasActive && !active && currentCollectionID) {
          void revalidate(schemaDraftQuery.keyFor({ collectionID: currentCollectionID }));
        }
      }
    )
  );
  createEffect(() => {
    const selectedID = selectedEntryID();
    const availableID = availableEntryID();

    if (availableID) {
      setOpenedEntryID(availableID);
    } else if (selectedID && openedEntryID() === selectedID && !content.loading()) {
      setOpenedEntryID(null);
      navigate(`/${workspaceID()}`, { replace: true });
    }
  });
  createEffect(() => {
    const editor = editorInstance();
    const loadState = documentLoadState();
    const target = getSearchNavigationTarget(location.state);
    const contentReady = Boolean(
      loadState?.editorReady && (loadState.initialSyncComplete || loadState.hasLocalSnapshot)
    );

    if (
      !editor ||
      !target ||
      target === handledSearchTarget() ||
      target.entryID !== selectedEntryID() ||
      !contentReady
    ) {
      return;
    }

    queueMicrotask(() => {
      if (editorInstance() !== editor) return;
      if (scrollToSearchTarget(editor, target)) setHandledSearchTarget(target);
    });
  });

  return (
    <>
      <DeleteThreadDialog
        thread={threadDeletion()}
        loading={deletingThread()}
        onConfirm={deleteThread}
        onClose={() => !deletingThread() && setThreadDeletion(null)}
      />
      <CollaborativeEditorPane
        documentID={selectedEntryID()}
        availableDocumentID={availableEntryID()}
        editable={editable()}
        comments={comments()}
        suggesting={editorSuggesting()}
        schemaFields={schemaFields()}
        loading={loading()}
        workspaceID={workspaceID()}
        user={currentSession()?.user}
        resourceLabel="entry"
        emptyTitle={emptyWorkspace() ? "No entries yet" : "No entry open"}
        emptyDescription={
          emptyWorkspace()
            ? "Create your first entry, or a collection to organize your entries."
            : "Select an entry in the explorer to start editing."
        }
        notFoundTitle="Entry not found"
        notFoundDescription="The entry was deleted or moved, or you don't have access to it."
        onBack={() => navigate(`/${workspaceID()}`)}
        onLoadStateChange={setDocumentLoadState}
        onEditor={(editor) => {
          // Debounced, but at most LIVE_STATUS_MAX_DELAY after the first change.
          const update = () => {
            const waited = Date.now() - (firstChange ??= Date.now());

            clearTimeout(updateTimer);
            updateTimer = setTimeout(
              () => {
                firstChange = undefined;
                setLiveDocument(editor.state.doc);
              },
              Math.min(LIVE_STATUS_DELAY, LIVE_STATUS_MAX_DELAY - waited)
            );
          };

          let updateTimer: ReturnType<typeof setTimeout> | undefined;
          let firstChange: number | undefined;

          setEditorInstance(editor);
          setLiveDocument(editor.state.doc);
          editor.on("update", update);

          return () => {
            clearTimeout(updateTimer);
            editor.off("update", update);

            if (editorInstance() === editor) {
              setEditorInstance(null);
              setLiveDocument(null);
            }
          };
        }}
        initialTitle={content.entries.get({ entryID: availableEntryID() || "" })?.name}
        validateTitle={(title, entryID) => {
          return content.validateName({
            id: entryID,
            parentID: content.entries.get({ entryID })?.collectionID,
            kind: "entry",
            name: title
          });
        }}
        onTitleChange={(title, entryID) => {
          const entries = content.entriesCollection();
          const entry = entries.findOne({ id: entryID }, { reactive: false });

          if (entry && entry.name !== title) {
            entries.updateOne({ id: entry.id }, { $set: { name: title } });
          }
        }}
      />
    </>
  );
};

export { EditorPane };
