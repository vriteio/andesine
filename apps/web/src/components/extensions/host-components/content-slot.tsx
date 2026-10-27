import clsx from "clsx";
import {
  type Component,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  useContext
} from "solid-js";
import type { ChildPresentation } from "@andesine/editor";
import { type HostComponentProps } from "./types";

interface ContentSlotHandle {
  contentDOM: HTMLElement;
  parking: HTMLElement;
  /** The slot that shows the content; only one slot of a view shows it. */
  owner: HTMLElement | null;
  /** Presents the content's child blocks by node ID, e.g. hidden. */
  setBlockPresentation?(presentation: ChildPresentation): void;
}

const ContentSlotContext = createContext<ContentSlotHandle>();

/** Text that isn't from widgets, e.g. collaborators' carets with their names. */
const hasText = (node: Element): boolean => {
  return [...node.childNodes].some((child) => {
    const isWidget = child instanceof Element && child.classList.contains("ProseMirror-widget");

    return !isWidget && Boolean(child.textContent);
  });
};
/** No blocks, or one empty paragraph: what an element holds before anything is written in it. */
const isEmptyContent = (content: HTMLElement): boolean => {
  const [first] = content.children;

  return !first || (content.children.length === 1 && first.tagName === "P" && !hasText(first));
};
/**
 * Moves the content, keeping a browser selection in it: a move collapses it, and the editor
 * would read that, e.g. a new tab's caret, set while its view mounts, would leave the tab.
 */
const moveContent = (parent: HTMLElement, content: HTMLElement) => {
  const selection = document.getSelection();
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection ?? {};
  const isInContent = Boolean(anchorNode && focusNode && content.contains(anchorNode));

  parent.append(content);

  if (isInContent)
    selection!.setBaseAndExtent(anchorNode!, anchorOffset!, focusNode!, focusOffset!);
};
/** Shows the element's host-owned content, with the view's `contentClass` on it. */
const ContentSlot: Component<HostComponentProps<"ContentSlot">> = (props) => {
  const slot = useContext(ContentSlotContext);
  const [empty, setEmpty] = createSignal(false);
  const [placeholderPosition, setPlaceholderPosition] = createSignal({ top: 0, left: 0 });
  const [blockless, setBlockless] = createSignal(false);

  let wrapper!: HTMLDivElement;
  let element!: HTMLDivElement;

  // The placeholder is on the empty paragraph's line, inside its margin and the slot's padding.
  const update = () => {
    const content = slot!.contentDOM;
    const isEmpty = isEmptyContent(content);

    setEmpty(isEmpty);
    setBlockless(!content.firstElementChild);

    // Only a shown placeholder needs the layout, e.g. not on each change in a file tree's rows.
    if (!isEmpty || !props.props.placeholder) return;

    const first = content.firstElementChild?.getBoundingClientRect();
    const box = wrapper.getBoundingClientRect();

    setPlaceholderPosition({
      top: first ? Math.max(first.top - box.top, 0) : 0,
      left: first ? Math.max(first.left - box.left, 0) : 0
    });
  };

  onMount(() => {
    if (!slot || slot.owner) return;

    const observer = new MutationObserver(update);
    // Layout changes move the first block too, e.g. when an accordion opens.
    const resizeObserver = new ResizeObserver(update);

    slot.owner = element;
    moveContent(element, slot.contentDOM);
    update();
    observer.observe(slot.contentDOM, { childList: true, subtree: true, characterData: true });
    resizeObserver.observe(wrapper);
    onCleanup(() => {
      observer.disconnect();
      resizeObserver.disconnect();
    });
  });
  // The editor owns the content element; only the view's own classes are added and removed.
  createEffect(() => {
    const classes = (props.props.contentClass ?? "").split(/\s+/).filter(Boolean);
    const content = slot?.contentDOM;

    if (!content || slot.owner !== element) return;

    content.classList.add(...classes);
    // The classes can move the first block, e.g. without its top margin.
    update();
    onCleanup(() => content.classList.remove(...classes));
  });
  onCleanup(() => {
    if (slot?.owner !== element) return;

    slot.owner = null;
    moveContent(slot.parking, slot.contentDOM);
  });

  // The placeholder lets clicks through: clicking empty content starts a paragraph in it. Without
  // blocks, it's a paragraph itself, so the content keeps an empty paragraph's height.
  return (
    <div
      ref={wrapper}
      class={clsx("relative min-w-0", props.props.class)}
      data-empty={empty() ? "" : undefined}
    >
      <Show when={props.props.placeholder && empty()}>
        <Show
          when={!blockless()}
          fallback={
            // With the content's classes, e.g. no outer margins, as a first paragraph has.
            <div class={props.props.contentClass} data-content-placeholder="">
              <p class="pointer-events-none select-none text-gray-400">{props.props.placeholder}</p>
            </div>
          }
        >
          <span
            class="pointer-events-none absolute select-none text-gray-400"
            style={{
              top: `${placeholderPosition().top}px`,
              left: `${placeholderPosition().left}px`
            }}
          >
            {props.props.placeholder}
          </span>
        </Show>
      </Show>
      {/* Only holds the content: `contents` keeps the slot's classes in charge of the layout. */}
      <div
        ref={element}
        data-content-slot=""
        data-block-controls={props.props.controls ? "" : undefined}
        class="contents"
      />
      {/* Presentations of the content, e.g. `BlockPresentation`; they render nothing. */}
      <div hidden>{props.children}</div>
    </div>
  );
};

/** Presents child blocks of the content, which the editor draws; from the SDK's `<Block>`. */
const BlockPresentation: Component<HostComponentProps<"BlockPresentation">> = (props) => {
  const slot = useContext(ContentSlotContext);
  const presentation = createMemo(
    () => ({ hidden: props.props.hidden, plain: props.props.plain }),
    undefined,
    { equals: (previous, next) => JSON.stringify(previous) === JSON.stringify(next) }
  );

  createEffect(() => slot?.setBlockPresentation?.(presentation()));
  onCleanup(() => slot?.setBlockPresentation?.({ hidden: [], plain: [] }));

  return null;
};

/**
 * Marks a view's UI that stands for a block, with the editor behaviors that the view turns on. The
 * editor activates it, e.g. on Enter, with a `block-activate` event, for the view's `onActivate`.
 */
const BlockArea: Component<HostComponentProps<"BlockArea">> = (props) => {
  const flag = (enabled?: boolean) => (enabled ? "" : undefined);
  const hasActivate = () => props.hasEvent("onActivate");

  return (
    <div
      ref={(element) => element.addEventListener("block-activate", () => props.emit("onActivate"))}
      class="contents"
      data-block-activate={flag(hasActivate())}
      data-block-area={props.props.block}
      data-block-menu={flag(props.props.menu)}
      data-block-draggable={flag(props.props.draggable)}
      data-block-controls={flag(props.props.controls)}
      data-block-selectable={flag(props.props.selectable)}
      data-block-marks-selection={flag(props.props.marksSelection)}
      data-block-droppable={
        props.props.droppable === "append" ? "append" : props.props.droppable ? "place" : undefined
      }
    >
      {props.children}
    </div>
  );
};

export { BlockArea, BlockPresentation, ContentSlot, ContentSlotContext };
export type { ContentSlotHandle };
