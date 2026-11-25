import { createRef, ScrollShadow } from "@andesine/components";
import clsx from "clsx";
import { type Component, createSignal, type JSX, onCleanup, onMount } from "solid-js";

interface PanelLayoutProps {
  title: string;
  titleClass?: string;
  headerClass?: string;
  headerActions?: JSX.Element;
  subheader?: JSX.Element;
  class?: string;
  contentClass?: string;
  headerRef?(element: HTMLElement): void;
  scrollRef?(element: HTMLElement): void;
  children?: JSX.Element;
}

const PANEL_TITLE_ROW_CLASS = "relative flex h-11.5 pt-1 pb-1.5 items-center";
const PanelLayout: Component<PanelLayoutProps> = (props) => {
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = createSignal(0);

  let header: HTMLElement | undefined;

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      // Safari before 15.4 has no `borderBoxSize`
      setHeaderHeight(entry.borderBoxSize?.[0]?.blockSize ?? header!.offsetHeight);
    });

    observer.observe(header!);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div class={clsx("relative flex min-h-0 w-full", props.class)}>
      <div class="pointer-events-none absolute inset-y-0 left-0 right-3 overflow-hidden">
        <ScrollShadow
          color="panel"
          offset={{ top: `${headerHeight()}px` }}
          scrollableContainerRef={scrollableContainerRef}
        />
      </div>
      <div
        ref={(element) => {
          setScrollableContainerRef(element);
          props.scrollRef?.(element);
        }}
        class={clsx(
          "relative flex min-h-0 w-full flex-1 flex-col scrollbar-panel scrollbar-hover overflow-y-auto px-1 md:pr-2",
          props.contentClass
        )}
      >
        <div
          ref={(element) => {
            header = element;
            props.headerRef?.(element);
          }}
          class="sticky top-0 z-20 -mx-1 md:-mr-2 flex shrink-0 flex-col px-1 md:pr-2 bg-white md:bg-gray-100"
        >
          <div class={clsx(PANEL_TITLE_ROW_CLASS, props.headerClass)}>
            <h2 class={clsx("min-w-0 truncate text-2xl font-semibold", props.titleClass)}>
              {props.title}
            </h2>
            {props.headerActions}
          </div>
          {props.subheader}
        </div>
        {props.children}
      </div>
    </div>
  );
};

export { PANEL_TITLE_ROW_CLASS, PanelLayout };
