import { Title } from "@solidjs/meta";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { type Component, createEffect, Show } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import { EditorPane } from "./editor-pane";
import { createRef } from "@andesine/components";
import { VersionPreviewPane } from "./version-preview-pane";
import { usePublishing } from "#web/context/publishing";
import { withWorkspacePanelParams } from "../panel-navigation";

const EntryPage: Component = () => {
  const params = useParams<{ slug?: string; workspaceID: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { content, currentWorkspace } = useWorkspace();
  const publishing = usePublishing();
  const [persistedEntryID, setPersistedEntryID] = createRef<string | undefined>(undefined);
  const getFallbackEntryID = () => {
    const preferredEntryID = persistedEntryID() || currentWorkspace()?.currentEntryID;
    const entries = content.entriesCollection().find().fetch();

    if (preferredEntryID && entries.some((entry) => entry.id === preferredEntryID)) {
      return preferredEntryID;
    }

    return entries.at(0)?.id;
  };
  const title = () => {
    const entry = params.slug ? content.entriesCollection().findOne({ id: params.slug }) : null;
    const deletedEntry = params.slug ? publishing.getDeletedEntry(params.slug) : null;

    return `${entry?.name || deletedEntry?.name || currentWorkspace()?.name || "Workspace"} | Andesine`;
  };

  createEffect(() => {
    const currentEntryID = getFallbackEntryID();

    if (!params.slug && currentEntryID) {
      navigate(withWorkspacePanelParams(`/${params.workspaceID}/${currentEntryID}`, searchParams), {
        replace: true
      });
    }
  });
  createEffect(() => {
    const entryID = params.slug;
    const snapshotPreview = typeof searchParams.snapshotID === "string";

    if (!entryID || !snapshotPreview) return;
    if (content.loading() || publishing.explorerOverlayLoading()) return;
    if (publishing.entryOverlaysError()) return;

    const entry = content.entriesCollection().findOne({ id: entryID });
    const entryOverlay = publishing.getEntryOverlayByEntryID(entryID);

    if (entry || entryOverlay) return;

    const fallbackEntryID = getFallbackEntryID();
    const fallbackPath = fallbackEntryID
      ? `/${params.workspaceID}/${fallbackEntryID}`
      : `/${params.workspaceID}`;

    navigate(withWorkspacePanelParams(fallbackPath, searchParams), { replace: true });
  });
  createEffect(() => {
    const entryID = params.slug;

    if (!entryID || persistedEntryID() === entryID) return;

    const entry = content.entriesCollection().findOne({ id: entryID });

    if (!entry) return;

    setPersistedEntryID(entryID);
    void client.sync.setCurrentEntry({ entryID }).catch(() => {});
  });

  return (
    <>
      <Title>{title()}</Title>
      <Show when={typeof searchParams.version === "string"} fallback={<EditorPane />}>
        <VersionPreviewPane />
      </Show>
    </>
  );
};

export default EntryPage;
