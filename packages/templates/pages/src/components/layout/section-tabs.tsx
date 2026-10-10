import type { SectionContext } from "@andesine/pages";
import { createTabIndicator } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, For, Show } from "solid-js";

interface SectionTabsProps {
  sections: SectionContext[];
}

// Lines sit on the last pixel row of the tabs, so the scroll container does not clip them.
const lineClass = "absolute bottom-0 h-px";

const SectionTabs: Component<SectionTabsProps> = (props) => {
  const indicator = createTabIndicator({
    current: () => props.sections.findIndex((section) => section.current)
  });

  return (
    <nav ref={indicator.rootRef} aria-label="Sections" class="relative">
      <span aria-hidden="true" class={clsx(lineClass, "inset-x-0 bg-gray-200")} />
      <div
        ref={indicator.scrollRef}
        class={clsx(
          "flex h-10 items-stretch gap-1 overflow-x-auto px-2",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        <For each={props.sections}>
          {(section, index) => (
            <a
              ref={(element) => indicator.tabRef(index(), element)}
              href={section.href}
              aria-current={section.current ? "location" : undefined}
              class={clsx(
                "relative flex shrink-0 items-center gap-2 px-2 text-sm font-medium transition duration-200 ease-out",
                section.current
                  ? "bg-gradient-to-tr bg-[length:125%_auto] bg-clip-text text-transparent @hover:bg-right focus-visible:bg-right"
                  : clsx(
                      "text-gray-500 @hover:text-gray-700 focus-visible:text-gray-700",
                      "after:(absolute inset-x-2 bottom-0 h-px bg-gray-400 opacity-0 transition-opacity duration-200 content-[''])",
                      "@hover:after:opacity-100 focus-visible:after:opacity-100"
                    )
              )}
            >
              {/* Shown until the indicator is measured. */}
              <Show when={section.current && !indicator.position()}>
                <span
                  aria-hidden="true"
                  class="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r"
                />
              </Show>
              <Show when={section.icon}>
                <span
                  aria-hidden="true"
                  class={clsx(
                    "h-4 w-4 shrink-0",
                    section.current && "bg-gradient-to-tr",
                    section.icon
                  )}
                />
              </Show>
              {section.label}
            </a>
          )}
        </For>
      </div>
      <Show when={indicator.position()}>
        {(position) => (
          <span
            aria-hidden="true"
            class="pointer-events-none absolute bottom-0 h-0.5 translate-y-[0.5px] rounded-full bg-gradient-to-r transition-[left,width] duration-200 ease-out"
            style={{
              left: `${position().left + 8}px`,
              width: `${Math.max(0, position().width - 16)}px`
            }}
          />
        )}
      </Show>
    </nav>
  );
};

export { SectionTabs };
