import { ScrollArea as ArkScrollArea } from "@ark-ui/solid/scroll-area";
import clsx from "clsx";
import { type ParentComponent, Show } from "solid-js";

interface ScrollAreaProps {
  class?: string;
  contentClass?: string;
  viewportClass?: string;
  viewportRef?(element: HTMLElement): void;
}

const ScrollArea: ParentComponent<ScrollAreaProps> = (props) => (
  <ArkScrollArea.Root
    class={clsx(":base: relative flex min-h-0 overflow-hidden", props.class)}
    asChild={(rootProps) => (
      <div {...rootProps()}>
        <ArkScrollArea.Viewport
          class={clsx(
            ":base: h-full w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            props.viewportClass
          )}
          asChild={(viewportProps) => (
            <div {...viewportProps()} ref={props.viewportRef}>
              <ArkScrollArea.Content
                class={props.contentClass}
                asChild={(contentProps) => <div {...contentProps()}>{props.children}</div>}
              />
            </div>
          )}
        />
        <ArkScrollArea.Context>
          {(scrollArea) => (
            <Show when={scrollArea().hasOverflowY}>
              <ArkScrollArea.Scrollbar
                class=":base: z-10 flex w-3 justify-center bg-gray-50 py-2.5"
                asChild={(scrollbarProps) => (
                  <div {...scrollbarProps()}>
                    <ArkScrollArea.Thumb
                      class=":base: w-full rounded-lg border-2 border-solid border-gray-50 bg-gray-100 shadow-inner"
                      asChild={(thumbProps) => <div {...thumbProps()} />}
                    />
                  </div>
                )}
              />
            </Show>
          )}
        </ArkScrollArea.Context>
      </div>
    )}
  />
);

export { ScrollArea };
export type { ScrollAreaProps };
