import { Title } from "#web/components/title";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { type Component, createEffect, Show } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { EditorPane } from "./editor-pane";
import { VersionPreviewPane } from "./version-preview-pane";
import { usePublishing } from "#web/context/publishing";
import { withWorkspacePanelParams } from "../panel-navigation";

const EntryPage: Component = () => {
  const params = useParams<{ slug?: string; workspaceID: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { content, currentEntryID, currentWorkspace, setCurrentEntry } = useWorkspace();
  const publishing = usePublishing();
  const getFallbackEntryID = () => {
    const preferredEntryID = currentEntryID();
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
    // A version preview of an entry that's gone, also from publishing, has nothing to go back to.
    const versionPreview =
      typeof searchParams.version === "string" || typeof searchParams.snapshotID === "string";

    if (!entryID || !versionPreview) return;
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

    if (entryID && content.entriesCollection().findOne({ id: entryID })) setCurrentEntry(entryID);
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
