import {
  type Card,
  DropdownArea,
  DropdownMenu,
  IconButton,
  type MenuItem
} from "@andesine/components";
import clsx from "clsx";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal
} from "solid-js";
import { TreeItem, useTree } from "#web/components/tree";
import { useClipboard } from "#web/context/clipboard";
import { type Share, type SharedEntry } from "#web/lib/data";
import { getShareURL } from "../../share-dialog";

interface SharedEntryItemProps {
  entry: SharedEntry;
  getEntries(ids: string[]): SharedEntry[];
  onOpenEntry(): void;
  onOpenSharing(): void;
  onRemove(entries: SharedEntry[]): void;
}

const formatCount = (count: number, noun: string, plural = `${noun}s`) => {
  return `${count} ${count === 1 ? noun : plural}`;
};
const getSummary = (shares: Share[]) => {
  const emails = shares.filter(({ kind }) => kind === "email").length;
  const parts = shares.some(({ kind }) => kind === "link") ? ["Link"] : [];

  return [...parts, ...(emails ? [formatCount(emails, "email")] : [])].join(", ");
};
const SharedEntryItem: Component<SharedEntryItemProps> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const { copyText } = useClipboard();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const link = () => props.entry.shares.find(({ kind }) => kind === "link");
  const visitors = () => props.entry.shares.reduce((sum, share) => sum + share.visitors, 0);
  const menuItems = createMemo((): MenuItem[][] => {
    const selected = props.getEntries(selection());
    const isMulti = selected.length > 1;
    const disable: MenuItem = {
      label: isMulti ? `Disable sharing of ${selected.length} entries` : "Disable sharing",
      icon: "i-lucide:trash-2",
      color: "danger",
      onClick: () => {
        props.onRemove(isMulti ? selected : [props.entry]);
        setSelection([]);
      }
    };

    if (isMulti) return [[disable]];

    return [
      [
        { label: "Sharing settings", icon: "i-tabler:world-share", onClick: props.onOpenSharing },
        ...(link()
          ? [
              {
                label: "Copy link",
                icon: "i-lucide:copy",
                onClick: () => copyText(getShareURL(link()!), { success: "Link copied" })
              }
            ]
          : []),
        { label: "Open entry", icon: "i-lucide:file-text", onClick: props.onOpenEntry }
      ],
      [disable]
    ];
  });

  createEffect(() => {
    if (menuOpened()) {
      setSelection((selectedIDs) => {
        return selectedIDs.includes(props.entry.id) ? selectedIDs : [props.entry.id];
      });
    }
  });

  return (
    <DropdownArea>
      <TreeItem
        id={props.entry.id}
        label={props.entry.name}
        topLevel
        checkbox
        selectable
        class="px-1 py-0.5"
        keyboardMenu={menuItems().flat()}
        onOpenMenu={() => setMenuOpened(true)}
        icon={<div class="i-lucide:file-text h-5.5 w-5.5 text-gray-400" />}
        onClick={props.onOpenSharing}
        renderLabel={(label) => (
          <div class="flex min-w-0 flex-1 items-center gap-1.5" title={props.entry.name}>
            <div class="min-w-0 truncate">{label}</div>
            <div class="hidden h-4 w-px shrink-0 rounded-full bg-gray-200 md:block" />
            <span class="hidden min-w-0 truncate text-xs text-gray-400 md:inline">
              {getSummary(props.entry.shares)}
            </span>
            <div class="flex-1" />
            <span class="shrink-0 text-xs text-gray-400">{formatCount(visitors(), "visitor")}</span>
          </div>
        )}
        actions={
          <div onClick={(event: MouseEvent) => event.stopPropagation()}>
            <DropdownMenu
              title={props.entry.name}
              cardProps={
                { "class": "w-56", "data-tree-interaction": "" } as Partial<
                  ComponentProps<typeof Card>
                >
              }
              opened={menuOpened()}
              portal={false}
              setOpened={setMenuOpened}
              items={menuItems()}
              trigger={() => (
                <div
                  class={clsx(!menuOpened() && "opacity-20 media-mouse:group-hover:opacity-100")}
                >
                  <IconButton
                    icon="i-lucide:ellipsis-vertical"
                    variant="ghost"
                    aria-label="Entry sharing"
                  />
                </div>
              )}
            />
          </div>
        }
      />
    </DropdownArea>
  );
};

export { formatCount, SharedEntryItem };
