import clsx from "clsx";
import { type Component, For, Show, createSignal, onCleanup } from "solid-js";
import { type Editor } from "@tiptap/core";
import { Card, IconButton, Shortcut, Tooltip } from "@andesine/components";
import { getBlockRangeOfSelection } from "#editor/extensions";
import { useBlockMenuContext } from "#editor/ui/menus/block-menu";

interface FormatMenuItemGroup {
  left: number;
  width: number;
  items: number;
}
interface FormatMenuProps {
  editor: Editor;
  class?: string;
  opened?: boolean;
  /** Only the comment action. */
  readOnly?: boolean;
  /** Shows the comment action. */
  onComment?(): void;
  setMode(mode: BubbleMenuMode): void;
}

type BubbleMenuMode = "format" | "link";

const FormatMenu: Component<FormatMenuProps> = (props) => {
  const { openMenu } = useBlockMenuContext();
  const [activeMarks, setActiveMarks] = createSignal<string[]>([]);
  const menuItems: Array<{
    icon: string;
    mark?: string;
    label: string;
    shortcut?: string;
    onClick?(): void;
  }> = [
    { icon: "i-lucide:bold", mark: "bold", label: "Bold", shortcut: "$mod+B" },
    { icon: "i-lucide:italic", mark: "italic", label: "Italic", shortcut: "$mod+I" },
    {
      icon: "i-lucide:strikethrough",
      mark: "strike",
      label: "Strikethrough",
      shortcut: "$mod+Shift+S"
    },
    { icon: "i-lucide:code", mark: "code", label: "Code", shortcut: "$mod+E" },
    {
      icon: "i-lucide:link-2",
      mark: "link",
      label: "Link",
      onClick() {
        props.setMode("link");
      }
    },
    {
      icon: "i-lucide:highlighter",
      mark: "highlight",
      label: "Highlight",
      shortcut: "$mod+Shift+H"
    },
    { icon: "i-lucide:subscript", mark: "subscript", label: "Subscript" },
    { icon: "i-lucide:superscript", mark: "superscript", label: "Superscript" }
  ];
  const markNames = menuItems.map((menu) => menu.mark).filter(Boolean) as string[];
  const updateActiveMarks = (): void => {
    setActiveMarks(markNames.filter((mark) => props.editor.isActive(mark)));
  };
  const activeGroups = () => {
    const active = activeMarks();
    const gap = 0.25;
    const padding = 0.25;
    const menuOptionWidth = 1.625;
    const activeGroups: FormatMenuItemGroup[] = [];

    let left = padding;
    let currentGroup: FormatMenuItemGroup | null = null;

    menuItems.forEach((item) => {
      const isActive = item.mark ? active.includes(item.mark) : false;

      if (isActive) {
        if (currentGroup) {
          currentGroup.width += menuOptionWidth + gap;
          currentGroup.items += 1;
        } else {
          currentGroup = { left, width: menuOptionWidth, items: 1 };
        }
      } else if (currentGroup) {
        activeGroups.push(currentGroup);
        currentGroup = null;
      }

      left += menuOptionWidth + gap;
    });

    if (currentGroup) {
      activeGroups.push(currentGroup);
    }

    return activeGroups;
  };

  props.editor.on("update", updateActiveMarks);
  props.editor.on("selectionUpdate", updateActiveMarks);
  updateActiveMarks();
  onCleanup(() => {
    props.editor.off("update", updateActiveMarks);
    props.editor.off("selectionUpdate", updateActiveMarks);
  });

  return (
    <Card
      data-menu="format"
      class={clsx(
        "z-10 relative flex w-full max-w-full p-1 gap-1 rounded-none overflow-x-auto scrollbar-hidden not-prose bg-white items-center md:w-auto md:max-w-none md:rounded-xl md:overflow-initial",
        props.class
      )}
      shade
    >
      <For each={props.readOnly ? [] : activeGroups()}>
        {(group) => (
          <div
            class="absolute top-1 bottom-1 -z-1 rounded-lg bg-gradient-to-tr opacity-10 pointer-events-none"
            style={{ left: `${group.left}rem`, width: `${group.width}rem` }}
          />
        )}
      </For>
      <For each={props.readOnly ? [] : menuItems}>
        {(menu) => {
          const active = (): boolean => {
            return Boolean(menu.mark && activeMarks().includes(menu.mark));
          };

          return (
            <div class="snap-start shrink-0">
              <Tooltip
                content={
                  <div class="flex flex-col items-center justify-center gap-0.5">
                    <span>{menu.label}</span>
                    {menu.shortcut && (
                      <Shortcut class="opacity-50 font-mono text-[80%]" shortcut={menu.shortcut} />
                    )}
                  </div>
                }
                enabled={props.opened}
                placement="bottom"
              >
                <IconButton
                  class={clsx(active() && "group/menu-item @hover:bg-gradient-to-tr")}
                  iconProps={{
                    class: clsx(
                      active() &&
                        "bg-gradient-to-tr media-mouse:group-hover/menu-item:from-white media-mouse:group-hover/menu-item:to-white"
                    )
                  }}
                  icon={menu.icon}
                  variant="ghost"
                  text="base"
                  size="xs"
                  onClick={(event) => {
                    if (menu.onClick) {
                      menu.onClick();
                    } else if (menu.mark) {
                      const chain = props.editor.chain();

                      if (menu.mark !== "code") {
                        chain.unsetCode();
                      }

                      chain.toggleMark(menu.mark).focus().run();
                    }

                    event.preventDefault();
                    event.stopPropagation();
                  }}
                />
              </Tooltip>
            </div>
          );
        }}
      </For>
      <Show when={!props.readOnly}>
        <Tooltip
          content={
            <div class="flex flex-col items-center justify-center gap-0.5">
              <span>Close keyboard</span>
            </div>
          }
          placement="bottom"
          wrapperClass="snap-start shrink-0 md:hidden"
          enabled={props.opened}
        >
          <IconButton
            variant="ghost"
            text="base"
            size="xs"
            icon="i-lucide:keyboard-off"
            aria-label="Close keyboard"
            onClick={(event) => {
              props.editor.chain().blur().setMeta("bubbleMenu", "hide").run();
              event.preventDefault();
              event.stopPropagation();
            }}
          />
        </Tooltip>
        <div class="w-px h-6 shrink-0 rounded-full bg-gray-200" />
      </Show>
      <Show when={props.onComment}>
        <Tooltip
          content={
            <div class="flex flex-col items-center justify-center gap-0.5">
              <span>Comment</span>
            </div>
          }
          placement="bottom"
          enabled={props.opened}
          wrapperClass="snap-start shrink-0"
        >
          <IconButton
            variant="ghost"
            text="base"
            size="xs"
            icon="i-tabler:message-plus"
            aria-label="Comment"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              props.onComment?.();
            }}
          />
        </Tooltip>
      </Show>
      <Show when={!props.readOnly}>
        <Tooltip
          content={
            <div class="flex flex-col items-center justify-center gap-0.5">
              <span>More</span>
            </div>
          }
          placement="bottom"
          enabled={props.opened}
          wrapperClass="snap-start shrink-0"
        >
          <IconButton
            variant="ghost"
            text="base"
            size="xs"
            icon="i-lucide:ellipsis"
            onClick={(event) => {
              const reference = event.currentTarget;
              const range = getBlockRangeOfSelection(props.editor);

              event.preventDefault();
              event.stopPropagation();

              if (!range) return;

              openMenu(reference);
              props.editor
                .chain()
                .setMeta("bubbleMenu", "hide")
                .setBlockSelection(range)
                .focus()
                .run();
            }}
          />
        </Tooltip>
      </Show>
    </Card>
  );
};

export { FormatMenu };
export type { BubbleMenuMode };
