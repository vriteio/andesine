import { createRef, IconButton } from "@andesine/components";
import type { EditorInstance, EditorSchemaField } from "@andesine/editor";
import { createAsync, revalidate, useLocation, useNavigate, useParams } from "@solidjs/router";
import { type Component, createEffect, createMemo, createSignal, on, Show } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import {
  getSearchNavigationTarget,
  scrollToSearchTarget,
  type SearchNavigationTarget
} from "#web/lib/search-navigation";
import { schemaDraftQuery } from "#web/lib/data/schema-versions";
import { CollaborativeEditorPane } from "../editor/collaborative-editor-pane";
import type { DocumentLoadState } from "../editor/document-load-state";

const EditorPane: Component = () => {
  const { currentWorkspace, currentSession, content } = useWorkspace();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [editorInstance, setEditorInstance] = createRef<EditorInstance | null>(null);
  const [documentLoadState, setDocumentLoadState] = createRef<DocumentLoadState | null>(null);
  const [handledSearchTarget, setHandledSearchTarget] = createRef<SearchNavigationTarget | null>(
    null
  );
  const [openedEntryID, setOpenedEntryID] = createRef<string | null>(null);
  const [schemaFields, setSchemaFields] = createSignal<EditorSchemaField[]>();
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
  const editable = createMemo(() => {
    return (
      !content.syncing() &&
      !content.hasActiveSchemaMigration(collectionID()) &&
      content.canEntry(collectionID(), "entry:update")
    );
  });
  const workspaceID = () => params.workspaceID || currentWorkspace()?.id || "unknown";
  // Actions depend on permissions, which load after the content.
  const loading = () => content.loading() || content.accessLoading();
  const emptyWorkspace = () => {
    return !loading() && !content.offline() && content.entriesCollection().find().count() === 0;
  };

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
    <CollaborativeEditorPane
      documentID={selectedEntryID()}
      availableDocumentID={availableEntryID()}
      editable={editable()}
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
        setEditorInstance(editor);

        return () => {
          if (editorInstance() === editor) setEditorInstance(null);
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
  );
};

export { EditorPane };
