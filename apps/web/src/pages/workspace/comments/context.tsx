import type { EditorCommentDraft, EditorCommentPlace, EditorComments } from "@andesine/editor";
import { createMediaQuery } from "@solid-primitives/media";
import { useSearchParams } from "@solidjs/router";
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  on,
  type ParentComponent,
  type Setter,
  useContext
} from "solid-js";
import { useLayout } from "#web/context/layout";
import { RIGHT_SIDE_PANEL_PARAM } from "../panel-navigation";

interface CommentsContextValue {
  comments: Accessor<EditorComments | null>;
  setComments: Setter<EditorComments | null>;
  active: Accessor<string | null>;
  /** `fromPanel` is false for a highlight click. */
  activate(threadID: string | null, fromPanel: boolean): void;
  /** Focuses the reply field when true. */
  activatedInPanel: Accessor<boolean>;
  order: Accessor<EditorCommentPlace[]>;
  setOrder: Setter<EditorCommentPlace[]>;
  panelOpened: Accessor<boolean>;
  /** On mobile, threads open in the panel's sheet. */
  mobile: Accessor<boolean>;
  sheetOpened: Accessor<boolean>;
  setSheetOpened: Setter<boolean>;
  draft: Accessor<EditorCommentDraft | null>;
  setDraft: Setter<EditorCommentDraft | null>;
  loading: Accessor<boolean>;
  setLoading: Setter<boolean>;
  suggesting: Accessor<boolean>;
  setSuggesting: Setter<boolean>;
  suggestionsShown: Accessor<boolean>;
  setSuggestionsShown: Setter<boolean>;
}

const COMMENTS_PANEL_ID = "comments";

const CommentsContext = createContext<CommentsContextValue>();

const CommentsProvider: ParentComponent = (props) => {
  const { layout } = useLayout();
  const [searchParams] = useSearchParams();
  const [comments, setComments] = createSignal<EditorComments | null>(null);
  const [active, setActive] = createSignal<string | null>(null);
  const [activatedInPanel, setActivatedInPanel] = createSignal(false);
  const [order, setOrder] = createSignal<EditorCommentPlace[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [draft, setDraft] = createSignal<EditorCommentDraft | null>(null);
  const [sheetOpened, setSheetOpened] = createSignal(false);
  const [suggesting, setSuggesting] = createSignal(false);
  const [suggestionsShown, setSuggestionsShown] = createSignal(true);
  const md = createMediaQuery("(min-width: 768px)");
  const mobile = () => !md();
  const panelOpened = () => {
    if (mobile()) return sheetOpened();

    return (
      searchParams[RIGHT_SIDE_PANEL_PARAM] === COMMENTS_PANEL_ID && layout.rightSidePanelWidth > 0
    );
  };
  const activate = (threadID: string | null, fromPanel: boolean) => {
    setActivatedInPanel(fromPanel);
    setActive(threadID);
  };

  // On mobile, also drops a draft, as it has no other place.
  createEffect(
    on(
      panelOpened,
      (opened) => {
        if (opened) return;

        setActive(null);
        if (mobile()) draft()?.cancel();
      },
      { defer: true }
    )
  );

  return (
    <CommentsContext.Provider
      value={{
        comments,
        setComments,
        active,
        activate,
        activatedInPanel,
        order,
        setOrder,
        panelOpened,
        mobile,
        sheetOpened,
        setSheetOpened,
        loading,
        setLoading,
        draft,
        setDraft,
        suggesting,
        setSuggesting,
        suggestionsShown,
        setSuggestionsShown
      }}
    >
      {props.children}
    </CommentsContext.Provider>
  );
};

const useComments = () => useContext(CommentsContext)!;

export { COMMENTS_PANEL_ID, CommentsProvider, useComments };
