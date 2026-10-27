import { Card, IconButton, Tooltip, getLinkedEntryID } from "@andesine/components";
import { type Editor } from "@tiptap/core";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import clsx from "clsx";
import {
  type Accessor,
  type Component,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import type { EditorLinks } from "#editor/client-types";
import { openLink } from "#editor/extensions/links";
import { EDITOR_MENU_Z_INDEX } from "#editor/ui/constants";
import { LinkMenu } from "#editor/ui/menus/bubble-menu/link";

interface LinkBubbleMenuProps {
  editor: Editor;
  links?: EditorLinks;
  menuContainerRef: Accessor<HTMLElement | null>;
}
interface LinkDetailsProps {
  href: string;
  links?: EditorLinks;
  onEdit(): void;
}

/** The link's target, e.g. an entry's title, as a link, with actions to copy and edit it. */
const LinkDetails: Component<LinkDetailsProps> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const entryID = () => getLinkedEntryID(props.href);
  const entry = () => {
    const id = entryID();

    return id ? props.links?.entries().find((item) => item.id === id) : undefined;
  };
  const isUnavailable = () => Boolean(entryID() && props.links && !entry());
  const label = () => {
    if (isUnavailable()) return "Deleted or unreadable entry";

    return entry()?.title ?? props.href;
  };
  // An entry link is the entry's app URL, with its anchor, e.g. to copy it.
  const url = () => {
    const id = entryID();
    const [, anchor] = props.href.split("#");

    if (!id || !props.links) return props.href;

    return anchor ? `${props.links.getEntryURL(id)}#${anchor}` : props.links.getEntryURL(id);
  };
  const copy = () => {
    navigator.clipboard
      .writeText(url())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  };

  return (
    <Card
      data-menu="link-details"
      class="not-prose flex max-w-80 items-center gap-1 rounded-xl bg-white p-1"
      shade
    >
      {/* The icon and the target are the link, as a slash menu item: an entry opens in the app. */}
      <Dynamic
        component={isUnavailable() ? "div" : "a"}
        {...(!isUnavailable() && { href: url(), target: "_blank", rel: "noopener noreferrer" })}
        title={entry()?.title ?? props.href}
        class={clsx(
          "group/link flex min-w-32 max-w-48 flex-1 items-center rounded-lg py-0.5 pl-0.75 pr-0.5 text-sm font-medium",
          isUnavailable()
            ? "text-gray-400"
            : "cursor-pointer text-gray-700 @hover:bg-gradient-to-r @hover:from-gray-500/10 @hover:to-transparent"
        )}
        onPointerDown={(event: PointerEvent) => event.preventDefault()}
        onClick={(event: MouseEvent) => {
          const isModified = event.metaKey || event.ctrlKey || event.shiftKey;

          if (!entryID() || isModified || isUnavailable()) return;

          event.preventDefault();
          openLink(props.href, props.links, false);
        }}
      >
        <div class="flex h-5.5 w-5.5 shrink-0 items-center justify-center">
          <div
            class={clsx(
              "h-5 w-5 text-gray-400",
              !isUnavailable() && "group-hover/link:text-gray-500",
              entryID() ? "i-lucide:file-text" : "i-lucide:globe"
            )}
          />
        </div>
        <span class="min-w-0 flex-1 truncate pl-1 text-left">{label()}</span>
      </Dynamic>
      <Tooltip content={copied() ? "Copied" : "Copy link"} placement="bottom">
        <IconButton
          icon={copied() ? "i-lucide:check" : "i-lucide:copy"}
          variant="ghost"
          text="base"
          size="xs"
          disabled={isUnavailable()}
          onPointerDown={(event) => event.preventDefault()}
          onClick={copy}
        />
      </Tooltip>
      <Tooltip content="Edit link" placement="bottom">
        <IconButton
          icon="i-lucide:pencil"
          variant="ghost"
          text="base"
          size="xs"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => props.onEdit()}
        />
      </Tooltip>
    </Card>
  );
};
/**
 * Below a hovered link, or a link with the cursor in it and no selection: its target to open,
 * and actions to copy or edit it.
 */
const LinkBubbleMenu: Component<LinkBubbleMenuProps> = (props) => {
  const [wrapper, setWrapper] = createSignal<HTMLElement | null>(null);
  const [opened, setOpened] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [href, setHref] = createSignal("");
  const isCursorInLink = () => {
    const { editor } = props;
    const { selection } = editor.state;
    const isCodeBlock = selection.$from.parent.type.name === "codeBlock";

    return editor.isEditable && selection.empty && !isCodeBlock && editor.isActive("link");
  };
  // The link's element, so the menu lines up with the link, not with the cursor.
  const getCursorLink = (): HTMLElement | null => {
    const { node } = props.editor.view.domAtPos(props.editor.state.selection.from);
    const element = node instanceof Element ? node : node.parentElement;

    return element?.closest("a[href]") ?? null;
  };
  const setMenu = (action: "show" | "hide" | "updatePosition") => {
    props.editor.view.dispatch(props.editor.state.tr.setMeta("linkMenu", action));
  };

  let hoveredLink: HTMLElement | null = null;
  let leaveTimer: number | undefined;

  const hover = (link: HTMLElement) => {
    clearTimeout(leaveTimer);

    if (editing() || link === hoveredLink) return;

    hoveredLink = link;
    setHref(link.getAttribute("href") || "");
    // Placed once it's on the page; "show" alone places it before adding it.
    setMenu("show");
    setMenu("updatePosition");
  };
  // After a moment, so the pointer can move from the link into the menu.
  const leave = () => {
    clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => {
      if (editing()) return;

      hoveredLink = null;

      if (isCursorInLink()) {
        setHref(props.editor.getAttributes("link").href || "");
        setMenu("updatePosition");
      } else {
        setMenu("hide");
      }
    }, 150);
  };
  // A hovered link is edited with the cursor in it, so the whole link changes.
  const edit = () => {
    if (hoveredLink) {
      const position = props.editor.view.posAtDOM(hoveredLink, 0) + 1;

      hoveredLink = null;
      props.editor.chain().focus().setTextSelection(position).run();
    }

    setEditing(true);
  };

  onMount(() => {
    const element = document.createElement("div");
    const editorElement = props.editor.view.dom;
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLElement>("a[href]");
      // Not while selecting, e.g. while the format menu shows for a selection.
      const canHover = event.buttons === 0 && props.editor.state.selection.empty;

      if (link && editorElement.contains(link) && canHover) hover(link);
    };
    const handleMouseOut = (event: MouseEvent) => {
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;

      if (hoveredLink && !hoveredLink.contains(related)) leave();
    };

    element.setAttribute("data-link-menu", "true");
    element.style.visibility = "hidden";
    element.style.position = "absolute";
    element.style.pointerEvents = "auto";
    element.style.zIndex = String(EDITOR_MENU_Z_INDEX.bubbleMenu);
    element.addEventListener("mouseenter", () => clearTimeout(leaveTimer));
    element.addEventListener("mouseleave", () => hoveredLink && leave());
    editorElement.addEventListener("mouseover", handleMouseOver);
    editorElement.addEventListener("mouseout", handleMouseOut);
    setWrapper(element);
    props.editor.registerPlugin(
      BubbleMenuPlugin({
        pluginKey: "linkMenu",
        element,
        editor: props.editor,
        appendTo: () => props.menuContainerRef()!,
        getReferencedVirtualElement: () => {
          const link = hoveredLink ?? getCursorLink();

          return link && { getBoundingClientRect: () => link.getBoundingClientRect() };
        },
        options: {
          placement: "bottom-start",
          offset: 6,
          onShow: () => setOpened(true),
          onHide: () => {
            hoveredLink = null;
            setOpened(false);
            setEditing(false);
          }
        },
        shouldShow: ({ editor, state, oldState }) => {
          // Moving the cursor ends a hover, e.g. into another link.
          if (oldState && !oldState.selection.eq(state.selection)) hoveredLink = null;

          if (hoveredLink?.isConnected && state.selection.empty) return true;

          if (isCursorInLink()) setHref(editor.getAttributes("link").href || "");

          return isCursorInLink();
        }
      })
    );
    onCleanup(() => {
      clearTimeout(leaveTimer);
      editorElement.removeEventListener("mouseover", handleMouseOver);
      editorElement.removeEventListener("mouseout", handleMouseOut);
    });
  });
  onCleanup(() => {
    setWrapper(null);
    props.editor.unregisterPlugin("linkMenu");
  });

  return (
    <Show when={wrapper()}>
      <Portal mount={wrapper()!}>
        <Switch>
          <Match when={editing()}>
            <LinkMenu
              editor={props.editor}
              links={props.links}
              opened={opened()}
              cursorLink
              setMode={() => setEditing(false)}
            />
          </Match>
          <Match when={href()}>
            <LinkDetails href={href()} links={props.links} onEdit={edit} />
          </Match>
        </Switch>
      </Portal>
    </Show>
  );
};

export { LinkBubbleMenu };
