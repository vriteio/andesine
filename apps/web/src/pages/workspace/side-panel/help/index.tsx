import { PanelLayout } from "#web/components/panel-layout";
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

const menu: HelpMenuSection[] = [
  {
    label: "Resources",
    items: [
      {
        icon: "i-lucide:book-open",
        label: "Documentation",
        href: "https://andesine.app/docs"
      },
      {
        icon: "i-lucide:square-terminal",
        label: "API Reference",
        href: "https://andesine.app/docs/api"
      },
      {
        icon: "i-lucide:bot",
        label: "Connect an AI App",
        href: "https://andesine.app/docs/ai-agents/connect-an-ai-app/"
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
        icon: "i-tabler:messages",
        label: "Join Discussions",
        href: "https://github.com/vriteio/andesine/discussions"
      }
    ]
  }
];

const HelpPanel: Component = () => {
  return (
    <PanelLayout title="Help" class="md:flex-1" contentClass="pb-1">
      <div class="flex flex-col gap-3">
        <For each={menu}>
          {(section) => (
            <MenuSection label={section.label}>
              <For each={section.items}>
                {(item) => (
                  <a
                    class="group relative flex min-h-7.5 w-full flex-1 select-none items-center gap-1 overflow-hidden rounded-lg pl-0.75 text-left font-medium text-row @hover:bg-gradient-to-r @hover:from-gray-500/10 @hover:to-transparent focus:outline-none"
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div class="flex h-6 w-6 items-center justify-center">
                      <div class={`${item.icon} h-5 w-5 text-gray-400`} />
                    </div>
                    <span class="min-w-0 flex-1 truncate">{item.label}</span>
                  </a>
                )}
              </For>
            </MenuSection>
          )}
        </For>
      </div>
    </PanelLayout>
  );
};

export { HelpPanel };
