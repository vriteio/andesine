import { useParams, useSearchParams } from "@solidjs/router";
import { type Component, createMemo } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { createEntryImages } from "../editor/images";
import {
  createEntryDraftResponse,
  createPublishedVersionDetailsResponse,
  createVersionDetailsResponse
} from "#web/lib/data";
import { VersionPreviewPane as SharedVersionPreviewPane } from "../version-history/preview-pane";

const VersionPreviewPane: Component = () => {
  const { currentWorkspace, currentSession } = useWorkspace();
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const versionID = () => {
    return typeof searchParams.version === "string" ? searchParams.version : "";
  };
  const snapshotID = () => {
    return typeof searchParams.snapshotID === "string" ? searchParams.snapshotID : "";
  };
  const comparing = () => searchParams.compare === "current";
  const images = createMemo(() => {
    const workspaceID = currentWorkspace()?.id;
    const userID = currentSession()?.user.id;
    const entryID = params.slug;

    if (!workspaceID || !userID || !entryID) return undefined;

    // History has a separate audience. Do not cache it as current-entry content.
    const options = {
      workspaceID,
      userID,
      entryID,
      cache: false,
      enabled: () => false
    };
    const current = createEntryImages(options);

    return {
      current,
      version: snapshotID() ? createEntryImages({ ...options, snapshotID: snapshotID() }) : current
    };
  });
  const versionResponse = createVersionDetailsResponse(() => (snapshotID() ? "" : versionID()));
  const publishedVersionResponse = createPublishedVersionDetailsResponse(
    () => (snapshotID() ? params.slug || "" : ""),
    snapshotID
  );
  const draftResponse = createEntryDraftResponse(() => (comparing() ? params.slug || "" : ""));
  const selectedVersionResponse = () => {
    return snapshotID() ? publishedVersionResponse() : versionResponse();
  };
  const version = () => {
    const selectedVersion = selectedVersionResponse()?.result;

    if (!selectedVersion) return undefined;

    return selectedVersion.entryID === params.slug && selectedVersion.id === versionID()
      ? selectedVersion
      : undefined;
  };
  const currentDocument = () => {
    const draft = draftResponse()?.result;

    return draft && draft.id === params.slug ? draft.content : undefined;
  };

  return (
    <SharedVersionPreviewPane
      version={version}
      images={images()?.version}
      currentImages={images()?.current}
      versionError={() => Boolean(selectedVersionResponse()?.error)}
      versionUnavailableDescription="This version could not be loaded or is no longer available."
      currentDocument={currentDocument}
      currentError={() => Boolean(draftResponse()?.error)}
      currentUnavailableDescription="The current document could not be loaded."
    />
  );
};

export { VersionPreviewPane };
