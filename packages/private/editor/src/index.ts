import {
  type Component,
  createComponent,
  createSignal,
  lazy,
  onMount,
  Show,
  Suspense
} from "solid-js";
import type { EditorProps } from "./client-types";
import "./styles.scss";

const ClientEditor = lazy(async () => ({
  default: (await import("./client")).ClientEditor
}));

const Editor: Component<EditorProps> = (props) => {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

  return createComponent(Show, {
    get when() {
      return mounted();
    },
    keyed: true,
    get children() {
      // Loading the editor suspends only the editor; the app shows its own loading state.
      return createComponent(Suspense, {
        get children() {
          return createComponent(ClientEditor, props);
        }
      });
    }
  });
};

export { Editor };
export type {
  EditorCommentInput,
  EditorCommentDraft,
  EditorCommentPlace,
  EditorComments,
  EditorCommentSuggestion,
  EditorOwnSuggestion,
  EditorSuggesting,
  EditorSuggestionPatch,
  EditorCommentsPanel,
  EditorCommentThread,
  EditorImages,
  EditorLinks,
  EditorImageAsset,
  EditorDiff,
  EditorDiffChange,
  EditorInstance,
  EditorMode,
  EditorSchemaField,
  EditorProps,
  EditorProvider,
  EditorProviderSetup,
  EditorProviderSetupResult,
  ElementViewMount,
  ElementViewRenderer,
  ElementViewOption,
  ElementViews,
  ElementPropField,
  ElementChild,
  ChildPresentation,
  ElementAccepts,
  ElementViewDescription,
  ElementPropsSchema,
  BlockAction,
  BlockActionOrigin,
  BlockMenuPlacement,
  BlockActions,
  BlockActionTarget,
  MergedVersionDiff,
  VersionComparison
} from "./client-types";
export { createVersionComparison } from "./extensions/version-diff";
export {
  canToggleResolved,
  getStaleStatus,
  isOpenSuggestion,
  rebaseSuggestion
} from "./lib/suggestion-status";
export { isRejectedSave } from "./lib/suggestion-patches";
export { applySuggestion } from "./extensions/suggestion-apply";
export { updateComments } from "./extensions/comments";
export { isSharedBlock } from "./extensions/suggesting";
