import clsx from "clsx";
import { type Component, createEffect, createSignal, type JSX, Show, untrack } from "solid-js";
import { Portal } from "solid-js/web";
import { Menu } from "@ark-ui/solid/menu";
import { createMediaQuery } from "@solid-primitives/media";
import { Card } from "../card";
import { createRef } from "../../ref";
import { useMobileDropdownDrag } from "./use-dropdown-mobile-drag";
import { useDropdownContext } from "./dropdown-context";

interface DropdownMobileSheetProps {
  host: boolean;
}

interface DropdownMobileContentProps {
  active: boolean;
  children: JSX.Element;
  opened: boolean;
}

const HANDLE_RELEASE_EVENTS = ["pointerup", "pointercancel", "touchend", "touchcancel"];

const DropdownMobileSheet: Component<DropdownMobileSheetProps> = (props) => {
  const [backdropPressed, setBackdropPressed] = createRef(false);
  const [handleHeld, setHandleHeld] = createSignal(false);
  const {
    activeMobileDropdown,
    closeMobileDropdowns,
    finishClosingMobileDropdowns,
    mobileDropdownExpanded,
    mobileDropdownStack,
    navigateMobileDropdownBack,
    setMobileDropdownContentContainer,
    setMobileDropdownExpanded
  } = useDropdownContext();
  const reducedMotion = createMediaQuery("(prefers-reduced-motion: reduce)");
  const opened = () => mobileDropdownStack().length > 0;
  const activeEntry = activeMobileDropdown;
  const previousTitle = () => {
    const stack = mobileDropdownStack();

    return stack.at(-2)?.getTitle();
  };
  const navigationTitle = () => {
    return activeEntry()?.getNavigationBackAvailable()
      ? activeEntry()?.getNavigationTitle()
      : previousTitle();
  };
  const cardProps = () => activeEntry()?.getCardProps();
  const dragFromContent = () => activeEntry()?.getDragFromContent() !== false;
  const releaseHandle = () => {
    setHandleHeld(false);
    HANDLE_RELEASE_EVENTS.forEach((type) => window.removeEventListener(type, releaseHandle, true));
  };
  const holdHandle = () => {
    setHandleHeld(true);
    HANDLE_RELEASE_EVENTS.forEach((type) => window.addEventListener(type, releaseHandle, true));
  };
  // Runs before the first paint, so the sheet is first seen at the toolbar's height
  const expandOnFirstLayout = (element: HTMLElement) => {
    const observer = new ResizeObserver(() => {
      observer.disconnect();
      drag.expandFromToolbar(element);
    });

    if (!reducedMotion()) observer.observe(element);
  };
  const progressTransition = () => {
    return drag.animated() ? `${drag.duration()}ms var(--mobile-sheet-easing)` : "0s";
  };
  const fadeStyle = () => {
    return { opacity: 1 - drag.closeProgress(), transition: `opacity ${progressTransition()}` };
  };
  const drag = useMobileDropdownDrag({
    expanded: mobileDropdownExpanded,
    opened,
    close: closeMobileDropdowns,
    setExpanded: setMobileDropdownExpanded
  });

  // Morphs the closing sheet into the `data-mobile-sheet-anchor` elements, e.g. a toolbar
  createEffect(() => {
    const root = document.documentElement;
    const closing = props.host && opened() && activeEntry()?.getClosing();
    const morphAvailable = "startViewTransition" in document && !reducedMotion();

    if (!closing) return;

    if (!morphAvailable) {
      finishClosingMobileDropdowns();

      return;
    }

    root.style.setProperty("--mobile-sheet-backdrop-opacity", `${1 - untrack(drag.closeProgress)}`);
    root.style.setProperty("--mobile-sheet-duration", `${untrack(drag.duration)}ms`);
    void document.startViewTransition(finishClosingMobileDropdowns).finished.finally(() => {
      root.style.removeProperty("--mobile-sheet-backdrop-opacity");
      root.style.removeProperty("--mobile-sheet-duration");
    });
  });

  return (
    <Show when={props.host && opened()}>
      <Portal>
        <Menu.Positioner class="!fixed !inset-0 !z-50 !w-auto !min-w-0 !max-w-none !transform-none flex select-none items-end pointer-events-none">
          <div
            {...drag.backdropGestureProps}
            data-mobile-sheet-backdrop
            class="absolute inset-0 touch-none pointer-events-auto backdrop-blur-sm"
            style={fadeStyle()}
            onPointerDown={(event) => {
              setBackdropPressed(event.isPrimary && event.button === 0);
              drag.backdropGestureProps.onPointerDown(event);
            }}
            onPointerCancel={() => {
              setBackdropPressed(false);
              drag.backdropGestureProps.onPointerCancel();
            }}
            onClick={(event) => {
              const shouldClose = backdropPressed();

              setBackdropPressed(false);
              event.preventDefault();
              event.stopPropagation();

              if (shouldClose) closeMobileDropdowns();
            }}
          >
            {/* Blends the blurred page into Safari's solid top bar */}
            <div class="pointer-events-none absolute inset-x-0 top-1.5 h-6 bg-gradient-to-b from-gray-50 to-transparent md:hidden" />
          </div>
          {/* Safari's bottom bar takes its color from here, not from the sheet */}
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-gray-50 md:hidden" />
          <Card
            {...(cardProps() || {})}
            data-dropdown-mobile-sheet
            ref={expandOnFirstLayout}
            style={{
              ...(cardProps()?.style || {}),
              "height": drag.height() ? `${drag.height()}px` : "auto",
              "min-height": drag.height() === null ? cardProps()?.style?.["min-height"] : "0px",
              "max-height":
                "calc(100dvh - var(--mobile-floating-top) - var(--mobile-floating-bottom))",
              "transition": `height ${progressTransition()}`
            }}
            onTransitionEnd={drag.onHeightTransitionEnd}
            class={clsx(
              ":base-2: fixed left-[var(--mobile-floating-left)] right-[var(--mobile-floating-right)] bottom-[var(--mobile-floating-bottom)] z-50 flex !w-auto min-w-0 max-w-none flex-col select-none rounded-2xl !border-0 p-1 pointer-events-auto bg-transparent [&_*]:overscroll-none",
              cardProps()?.class
            )}
          >
            <div
              data-mobile-sheet-surface
              class={clsx(
                "absolute inset-0 origin-bottom transition-transform duration-300 ease-[var(--mobile-sheet-easing)]",
                (handleHeld() || drag.dragging()) && "scale-x-[1.015] scale-y-[1.0075]"
              )}
            />
            <div
              {...(dragFromContent() ? drag.gestureProps : {})}
              data-mobile-sheet-content
              class="relative flex min-h-0 max-h-full w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-xl"
            >
              <div
                {...(!dragFromContent() ? drag.gestureProps : {})}
                aria-hidden="true"
                on:pointerdown={holdHandle}
                class="flex h-6 w-full shrink-0 touch-none cursor-ns-resize items-center justify-center outline-none"
              >
                <span
                  class="h-1.5 w-12 rounded-full bg-gray-200"
                  style={{
                    transform: `translateY(${drag.closeProgress() * 0.5}rem)`,
                    transition: `transform ${progressTransition()}`
                  }}
                />
              </div>
              <Show
                when={
                  activeEntry()?.getNavigationBackAvailable() || mobileDropdownStack().length > 1
                }
              >
                <button
                  type="button"
                  style={fadeStyle()}
                  class="mb-0.5 flex min-h-7 w-full cursor-pointer items-center gap-1 rounded-md px-0.5 text-gray-700 outline-none @hover:bg-gray-100"
                  aria-label={navigationTitle() ? `Back to ${navigationTitle()}` : "Back"}
                  onClick={navigateMobileDropdownBack}
                >
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center">
                    <div class="i-lucide:chevron-left h-5 w-5 text-gray-400" />
                  </div>
                  <span class="min-w-0 flex-1 truncate pr-7 text-center text-[16px] font-medium">
                    {navigationTitle() ? `Back to ${navigationTitle()}` : "Back"}
                  </span>
                </button>
              </Show>
              <div
                class="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto scrollbar-sm flex flex-col [&>div]:contents"
                data-dropdown-mobile-scroll
                style={fadeStyle()}
                ref={setMobileDropdownContentContainer}
              />
            </div>
          </Card>
        </Menu.Positioner>
      </Portal>
    </Show>
  );
};

const DropdownMobileContent: Component<DropdownMobileContentProps> = (props) => {
  const { mobileDropdownContentContainer } = useDropdownContext();

  return (
    <Show when={props.opened ? mobileDropdownContentContainer() : null} keyed>
      {(container) => (
        <Portal mount={container}>
          <Menu.Content
            class="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden focus:outline-none"
            style={{ display: props.active ? undefined : "none" }}
          >
            {props.children}
          </Menu.Content>
        </Portal>
      )}
    </Show>
  );
};

export { DropdownMobileContent, DropdownMobileSheet };
