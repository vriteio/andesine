import {
  type Accessor,
  createEffect,
  type JSX,
  onCleanup,
  type ParentComponent,
  Show
} from "solid-js";
import { TREE_ROOT_ID, TreeProvider, type TreeMap, type TreeSize } from "./tree-context";
import { TreeSelection } from "./tree-selection";
import { TreeLevel } from "./tree-level";
import { TreeRoot } from "./tree-root";
import { TreeKeyboard } from "./tree-keyboard";
import { Dynamic, Portal } from "solid-js/web";
import { Fragment } from "@andesine/components";
import { useTreeMarquee } from "./use-tree-marquee";

interface TreeProps {
  keyboard?: boolean;
  marquee?: boolean;
  marqueeContainer?: Accessor<HTMLElement | null>;
  tree: Accessor<TreeMap>;
  levelIDs?: Accessor<Record<string, unknown>>;
  initialExpanded?: Accessor<string[] | undefined>;
  expandedSourceKey?: Accessor<string | null>;
  renderLevel?(levelID: string): JSX.Element;
  renderItem?(itemID: string): JSX.Element;
  renderHeader?(): JSX.Element;
  selectionTransform?(selection: string[]): string[];
  emptyMessage?: string;
  itemHeight?: TreeSize;
  gap?: TreeSize;
}

const TreeContent: ParentComponent<TreeProps> = (props) => {
  let contentElement: HTMLDivElement | undefined;
  const marquee = props.marquee
    ? useTreeMarquee(
        () => props.marqueeContainer?.() ?? null,
        () => contentElement ?? null
      )
    : null;

  createEffect(() => {
    const container = props.marquee ? props.marqueeContainer?.() : null;

    if (!container || !marquee) return;

    container.addEventListener("pointerdown", marquee.onPointerDown);
    onCleanup(() => container.removeEventListener("pointerdown", marquee.onPointerDown));
  });

  return (
    <TreeRoot>
      <Dynamic component={props.keyboard ? TreeKeyboard : Fragment}>
        <div
          ref={(element) => {
            contentElement = element;
          }}
          data-tree-marquee={props.marquee ? "" : undefined}
          class="relative flex min-w-0 flex-col"
        >
          <TreeSelection transform={props.selectionTransform} />
          <TreeLevel
            levelID={TREE_ROOT_ID}
            tree={props.tree}
            renderLevel={props.renderLevel}
            renderItem={props.renderItem}
            emptyMessage={props.emptyMessage}
          />
        </div>
        {props.children}
        <Show when={marquee?.boxSelection().active}>
          <Portal>
            <div
              class="pointer-events-none fixed z-60 rounded-lg bg-gradient-to-tr opacity-10"
              style={{
                top: `${Math.min(marquee!.boxSelection().y, marquee!.boxSelection().currentY)}px`,
                left: `${Math.min(marquee!.boxSelection().x, marquee!.boxSelection().currentX)}px`,
                width: `${marquee!.boxSelection().width}px`,
                height: `${marquee!.boxSelection().height}px`
              }}
            />
          </Portal>
        </Show>
      </Dynamic>
    </TreeRoot>
  );
};

const Tree: ParentComponent<TreeProps> = (props) => (
  <TreeProvider
    tree={props.tree}
    levelIDs={props.levelIDs}
    initialExpanded={props.initialExpanded}
    expandedSourceKey={props.expandedSourceKey}
    itemHeight={props.itemHeight}
    gap={props.gap}
  >
    {props.renderHeader?.()}
    <TreeContent {...props} />
  </TreeProvider>
);

export { Tree };
export type { TreeProps };
