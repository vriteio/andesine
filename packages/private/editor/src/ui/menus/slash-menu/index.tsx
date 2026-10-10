import {
  type Accessor,
  type Component,
  createEffect,
  createMemo,
  onCleanup,
  untrack
} from "solid-js";
import { createSlashMenuPlugin, slashMenuPluginKey } from "./plugin";
import { type Editor } from "@tiptap/core";
import { createElementViewItems, createSlashMenuItems, withElementItems } from "./items";
import type { EditorMode, ElementViews } from "#editor/client-types";
import { MobileSlashMenuTrigger } from "./mobile-trigger";

interface SlashMenuProps {
  editor: Editor;
  menuContainerRef: Accessor<HTMLElement | null>;
  mode: EditorMode;
  elementViews?: ElementViews;
}

const SlashMenu: Component<SlashMenuProps> = (props) => {
  const menuItems = createSlashMenuItems();
  const elementItems = createMemo(() => createElementViewItems(props.elementViews?.list() ?? []));
  const items = () => withElementItems(menuItems, elementItems());

  createEffect(() => {
    const slashMenuPlugin = createSlashMenuPlugin({
      editor: props.editor,
      menuContainerRef: props.menuContainerRef,
      menuItems: items,
      mode: props.mode
    });

    const editor = props.editor;

    // Registering updates every plugin view; their reactive reads must not re-run this effect.
    untrack(() =>
      editor.registerPlugin(slashMenuPlugin, (plugin, plugins) => [plugin, ...plugins])
    );
    onCleanup(() => untrack(() => editor.unregisterPlugin(slashMenuPluginKey)));
  });
  return (
    <MobileSlashMenuTrigger
      editor={props.editor}
      menuContainerRef={props.menuContainerRef}
      mode={props.mode}
      items={items}
    />
  );
};

export { SlashMenu };
