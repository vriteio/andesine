import { useParams, useSearchParams } from "@solidjs/router";
import { type Component, createMemo } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { createEntryImages } from "../editor/images";
import { createEntryDraftResponse, createVersionDetailsResponse } from "#web/lib/data";
import { VersionPreviewPane as SharedVersionPreviewPane } from "../version-history/preview-pane";

const VersionPreviewPane: Component = () => {
  const { currentWorkspace, currentSession } = useWorkspace();
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const versionID = () => {
    return typeof searchParams.version === "string" ? searchParams.version : "";
  };
  const comparing = () => searchParams.compare === "current";
  const images = createMemo(() => {
    const workspaceID = currentWorkspace()?.id;
    const userID = currentSession()?.user.id;
    const entryID = params.slug;

    if (!workspaceID || !userID || !entryID) return undefined;

    // History has a separate audience. Do not cache it as current-entry content.
    return createEntryImages({ workspaceID, userID, entryID, cache: false, enabled: () => false });
  });
  const versionResponse = createVersionDetailsResponse(versionID);
  const draftResponse = createEntryDraftResponse(() => (comparing() ? params.slug || "" : ""));
  const version = () => {
    const selectedVersion = versionResponse()?.result;

    return selectedVersion?.entryID === params.slug ? selectedVersion : undefined;
  };
  const currentDocument = () => {
    const draft = draftResponse()?.result;

    return draft && draft.id === params.slug ? draft.content : undefined;
  };

  return (
    <SharedVersionPreviewPane
      version={version}
      images={images()}
      versionError={() => Boolean(versionResponse()?.error)}
      versionUnavailableDescription="This version could not be loaded or is no longer available."
      currentDocument={currentDocument}
      currentError={() => Boolean(draftResponse()?.error)}
      currentUnavailableDescription="The current document could not be loaded."
    />
  );
};

export { VersionPreviewPane };
