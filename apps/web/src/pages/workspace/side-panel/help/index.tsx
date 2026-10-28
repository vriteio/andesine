import { createRef, ScrollShadow } from "@andesine/components";
import { type Component, For } from "solid-js";
import { MenuSection } from "#web/components/menu-section";

interface HelpMenuItem {
  icon: string;
  label: string;
  href: string;
}

interface HelpMenuSection {
  label: string;
  items: HelpMenuItem[];
}

// TODO: Update links once new resources are available
const menu: HelpMenuSection[] = [
  {
    label: "Resources",
    items: [
      {
        icon: "i-lucide:book-open",
        label: "Documentation",
        href: "https://docs.vrite.io"
      },
      {
        icon: "i-lucide:square-terminal",
        label: "API Reference",
        href: "https://docs.vrite.io/api/authentication"
      }
    ]
  },
  {
    label: "Community",
    items: [
      {
        icon: "i-tabler:brand-github",
        label: "Star on GitHub",
        href: "https://github.com/vriteio/andesine"
      },
      {
        icon: "i-tabler:brand-discord",
        label: "Join Discord",
        href: "https://discord.gg/yYqDWyKnqE"
      }
    ]
  }
];

const HelpPanel: Component = () => {
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);

  return (
    <div class="relative flex min-h-0 w-full md:flex-1">
      <div class="pointer-events-none absolute inset-y-0 left-0 right-3 overflow-hidden">
        <ScrollShadow
          color="contrast"
          offset={{ top: "2.25rem" }}
          scrollableContainerRef={scrollableContainerRef}
        />
      </div>
      <div
        ref={setScrollableContainerRef}
        class="relative flex min-h-0 w-full flex-col scrollbar-contrast scrollbar-hover overflow-y-auto px-1 pb-1 md:flex-1"
      >
        <div class="sticky top-0 z-20 -mx-1 flex h-9 shrink-0 items-center px-1 bg-white md:bg-gray-100">
          <h2 class="text-2xl font-semibold">Help</h2>
        </div>
        <div class="flex flex-col gap-3">
          <For each={menu}>
            {(section) => (
              <MenuSection label={section.label}>
                <For each={section.items}>
                  {(item) => (
                    <a
                      class="group relative flex min-h-7 w-full flex-1 select-none items-center gap-1 overflow-hidden rounded-lg pl-0.5 text-left font-medium @hover:bg-gradient-to-r @hover:from-gray-500/10 @hover:to-transparent focus:outline-none"
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div class="flex h-6 w-6 items-center justify-center">
                        <div class={`${item.icon} h-5 w-5 text-gray-400`} />
                      </div>
                      <span class="flex-1 line-clamp-1">{item.label}</span>
                    </a>
                  )}
                </For>
              </MenuSection>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

export { HelpPanel };
