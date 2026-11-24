import { FormatMenu, type BubbleMenuMode } from "./format";
import { LinkMenu } from "./link";
import {
  type Accessor,
  type Component,
  createEffect,
  createSignal,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch
} from "solid-js";
import { type Editor, isTextSelection } from "@tiptap/core";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import { Portal } from "solid-js/web";
import {
  getTextCommentTarget,
  isBlockSelection,
  isSharedRange,
  updateComments
} from "#editor/extensions";
import { EDITOR_MENU_Z_INDEX } from "#editor/ui/constants";
import { useBlockMenuContext } from "#editor/ui/menus/block-menu";
import { rangeContainsCode, rangeContainsInheritedField } from "#editor/ui/block-utils";
import type { EditorComments, EditorLinks } from "#editor/client-types";

interface BubbleMenuProps {
  editor: Editor;
  links?: EditorLinks;
  comments?: EditorComments;
  /** Only the comment action. */
  readOnly?: boolean;
  menuContainerRef: Accessor<HTMLElement | null>;
}

const BubbleMenu: Component<BubbleMenuProps> = (props) => {
  const { setTextMenuSelectionRange } = useBlockMenuContext();
  const [wrapper, setWrapper] = createSignal<HTMLElement | null>(null);
  const [opened, setOpened] = createSignal(false);
  const [mode, setMode] = createSignal<BubbleMenuMode>("format");
  const [shared, setShared] = createSignal(true);
  const updateTextMenuSelectionRange = () => {
    const selection = props.editor.state.selection;

    if (isTextSelection(selection) && !selection.empty) {
      setTextMenuSelectionRange({ from: selection.from, to: selection.to });
      setShared(isSharedRange(props.editor, selection.from, selection.to));
    }
  };
  const handleShow = () => {
    setOpened(true);
    updateTextMenuSelectionRange();
  };
  const handleHide = () => {
    setOpened(false);
    setTextMenuSelectionRange(null);
  };
  const startComment = () => {
    const draft = getTextCommentTarget(props.editor);

    if (!draft) return;

    updateComments(props.editor, { draft });
    props.editor.view.dispatch(props.editor.state.tr.setMeta("bubbleMenu", "hide"));
  };

  createEffect(
    on(opened, (opened) => {
      if (!opened) {
        setTimeout(() => setMode("format"), 300);
      }
    })
  );

  onMount(() => {
    const wrapper = document.createElement("div");

    wrapper.setAttribute("data-text-menu", "true");
    wrapper.style.visibility = "hidden";
    wrapper.style.position = "absolute";
    wrapper.style.pointerEvents = "auto";
    wrapper.style.zIndex = String(EDITOR_MENU_Z_INDEX.bubbleMenu);
    setWrapper(wrapper);
    props.editor.registerPlugin(
      BubbleMenuPlugin({
        pluginKey: "bubbleMenu",
        element: wrapper,
        editor: props.editor,
        appendTo: () => props.menuContainerRef()!,
        options: {
          onHide: handleHide,
          onShow: handleShow,
          onUpdate: updateTextMenuSelectionRange
        },
        shouldShow: ({ editor }) => {
          const { selection } = editor.state;
          const isTitleSelection = selection.$from.parent.type.name === "title";
          const shouldShow =
            !rangeContainsCode(editor.state.doc, selection.from, selection.to) &&
            !isTitleSelection &&
            !rangeContainsInheritedField(editor.state.doc, selection.from, selection.to) &&
            !isBlockSelection(selection) &&
            isTextSelection(selection) &&
            !selection.empty &&
            editor.state.doc.textBetween(selection.from, selection.to).trim().length > 0;

          setOpened(shouldShow);

          return shouldShow;
        }
      })
    );
  });
  onCleanup(() => {
    setWrapper(null);
    setTextMenuSelectionRange(null);
    props.editor.unregisterPlugin("bubbleMenu");
  });

  return (
    <Show when={wrapper()}>
      <Portal mount={wrapper()!}>
        <Switch>
          <Match when={mode() === "link"}>
            <LinkMenu
              editor={props.editor}
              links={props.links}
              opened={opened()}
              setMode={setMode}
            />
          </Match>
          <Match when={mode() === "format"}>
            <FormatMenu
              editor={props.editor}
              opened={opened()}
              readOnly={props.readOnly}
              onComment={props.comments?.canComment && shared() ? startComment : undefined}
              setMode={setMode}
            />
          </Match>
        </Switch>
      </Portal>
    </Show>
  );
};

export { BubbleMenu };
export type { BubbleMenuMode };
