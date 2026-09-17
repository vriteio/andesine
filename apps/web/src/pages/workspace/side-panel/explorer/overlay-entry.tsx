import {
  type Card,
  DropdownArea,
  DropdownMenu,
  IconButton,
  type MenuItem,
  Spinner,
  Tooltip
} from "@andesine/components";
import { TreeItem, useTree } from "#web/components/tree";
import { usePublishing } from "#web/context/publishing";
import { useWorkspace } from "#web/context/workspace";
import {
  getPublishingEntryOverlayID,
  type PendingPublishingEntryOverlay,
  type PublishingEntryOverlay
} from "#web/lib/data";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import clsx from "clsx";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createSignal,
  on,
  Show
} from "solid-js";
import { withWorkspacePanelParams } from "../../panel-navigation";
import { EXPLORER_GESTURE_PROPS } from "./explorer-dnd";
import { usePublishingActions } from "./publishing-actions";

interface OverlayEntryProps {
  entry: OverlayEntryData;
  topLevel?: boolean;
}

type OverlayEntryData = PendingPublishingEntryOverlay | PublishingEntryOverlay;

const getOverlayEntryPath = (workspaceID: string, entry: PublishingEntryOverlay): string => {
  const searchParams = new URLSearchParams({
    snapshotID: entry.snapshotID,
    version: entry.versionID
  });

  if (entry.channel !== "published") searchParams.set("channel", entry.channel);

  return `/${workspaceID}/${entry.entryID}?${searchParams.toString()}`;
};

const OverlayEntry: Component<OverlayEntryProps> = (props) => {
  const { workspaceID } = useWorkspace();
  const publishing = usePublishing();
  const publishingActions = usePublishingActions();
  const navigate = useNavigate();
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const [{ isSelected, selection }, { setSelection }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const confirmedEntry = () => {
    return "snapshotID" in props.entry ? props.entry : undefined;
  };
  const loading = () => {
    return !confirmedEntry() || publishing.isEntryReverting(props.entry.entryID);
  };
  const overlayID = () => getPublishingEntryOverlayID(props.entry);
  const opened = () => {
    const entry = confirmedEntry();

    return Boolean(
      entry && params.slug === entry.entryID && searchParams.snapshotID === entry.snapshotID
    );
  };
  const dropdownOptions = (): MenuItem[][] => {
    const entry = confirmedEntry();
    const options: MenuItem[] = [];
    const revertTarget = { ids: [overlayID()], type: "entry" as const };

    if (!entry) return [];

    if (publishingActions.canRevert(revertTarget)) {
      options.push({
        label: "Revert pending changes",
        icon: "i-lucide:undo-2",
        disabled: publishingActions.revertPending(),
        onClick: () => publishingActions.openRevert(revertTarget)
      });
    }

    if (entry.canUnpublish) {
      options.push({
        label: "Unpublish",
        icon: "i-material-symbols:unpublished-outline-rounded",
        onClick: () => {
          publishingActions.open(
            "unpublish",
            { ids: [entry.entryID], type: "entry" },
            entry.channel
          );
        }
      });
    }

    return options.length > 0 ? [options] : [];
  };
  const open = () => {
    const entry = confirmedEntry();

    if (!entry) return;

    navigate(withWorkspacePanelParams(getOverlayEntryPath(workspaceID(), entry), searchParams));
  };

  createEffect(
    on(menuOpened, (opened) => {
      if (!opened || selection().includes(overlayID())) return;

      setSelection([overlayID()]);
    })
  );

  return (
    <DropdownArea {...EXPLORER_GESTURE_PROPS}>
      <div class="flex min-h-7 w-full" data-entry={props.entry.entryID} data-explorer-item>
        <TreeItem
          class="!overflow-visible"
          id={overlayID()}
          label={props.entry.name}
          topLevel={props.topLevel}
          selectable
          dataAttributes={{ entry: props.entry.entryID }}
          keyboardMenu={dropdownOptions().flat()}
          onClick={open}
          onOpenMenu={() => {
            if (!loading()) setMenuOpened(true);
          }}
          icon={
            <div class="relative h-full w-full">
              <div
                class={clsx(
                  "h-full w-full text-gray-400 i-lucide:file-text",
                  isSelected(overlayID()) && "bg-gradient-to-tr"
                )}
              />
              <Tooltip
                content={
                  props.entry.reason === "deleted" ? "Pending removal" : "Moved, pending removal"
                }
                placement="right"
                fixed
                wrapperClass="absolute -top-0.5 -left-0.5 h-3 w-3"
              >
                <div class="flex h-3 w-3 items-center justify-center rounded-lg bg-gray-100/80">
                  <div
                    class={clsx(
                      "flex h-2.5 w-2.5 items-center justify-center i-lucide:radio",
                      props.entry.reason === "deleted" ? "text-red-500" : "text-amber-500"
                    )}
                  />
                </div>
              </Tooltip>
            </div>
          }
          renderLabel={(label) => <span class="flex min-w-0 flex-1 line-through">{label}</span>}
          actions={
            <Show
              when={!loading()}
              fallback={
                <div class="flex h-7 w-7 items-center justify-center">
                  <Spinner class="h-4 w-4" color="primary" />
                </div>
              }
            >
              <Show
                when={dropdownOptions().length > 0}
                fallback={
                  <Show when={opened()}>
                    <div class="absolute right-0 top-0 hidden h-7 w-7 items-center justify-center media-mouse:flex media-mouse:group-hover:hidden">
                      <div class="h-4 w-4 bg-gradient-to-tr from-secondary via-primary to-secondary i-lucide:eye" />
                    </div>
                  </Show>
                }
              >
                <DropdownMenu
                  title={props.entry.name}
                  cardProps={
                    {
                      "class": "w-52",
                      "data-tree-interaction": ""
                    } as Partial<ComponentProps<typeof Card>>
                  }
                  items={dropdownOptions()}
                  opened={menuOpened()}
                  mobileSheetDragFromContent={false}
                  portal={false}
                  setOpened={setMenuOpened}
                  onClick={(event) => event.stopPropagation()}
                  trigger={() => (
                    <Show when={selection().length <= 1} fallback={<div />}>
                      <div
                        class={clsx(
                          "shrink-0",
                          opened()
                            ? !menuOpened() &&
                                "opacity-20 media-mouse:opacity-0 media-mouse:group-hover:opacity-100"
                            : !menuOpened() &&
                                "opacity-20 media-mouse:hidden media-mouse:group-hover:flex media-mouse:group-hover:opacity-100"
                        )}
                      >
                        <IconButton
                          data-entry-menu-trigger
                          icon="i-lucide:ellipsis-vertical"
                          size="small"
                          variant="text"
                          text="soft"
                        />
                      </div>
                    </Show>
                  )}
                />
                <Show when={opened() && !menuOpened()}>
                  <div
                    class={clsx(
                      "absolute right-0 top-0 hidden h-7 w-7 items-center justify-center media-mouse:flex",
                      selection().length <= 1 && "media-mouse:group-hover:hidden"
                    )}
                  >
                    <div class="h-4 w-4 bg-gradient-to-tr from-secondary via-primary to-secondary i-lucide:eye" />
                  </div>
                </Show>
              </Show>
            </Show>
          }
        />
      </div>
    </DropdownArea>
  );
};

export { getOverlayEntryPath, OverlayEntry };
export type { OverlayEntryProps };
