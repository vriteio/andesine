import type { PageContext, SectionContext } from "@andesine/pages";
import { MobileNavigation as Menu } from "@andesine/ui/solid";
import { type Component, Show } from "solid-js";
import { Button } from "../primitives/button";
import { Logo } from "../primitives/logo";
import { NavigationLinks } from "./navigation-links";
import { NavigationTree } from "./navigation-tree";
import { PoweredBy } from "./powered-by";

interface MobileNavigationProps {
  page: Pick<PageContext, "site" | "links" | "navigation">;
  /** Sections to show above the navigation, when the header has no tabs. */
  sections: SectionContext[];
  storageKey: string;
}

const MobileNavigation: Component<MobileNavigationProps> = (props) => (
  <Menu.Root
    mediaQuery="(max-width: 767.9px)"
    navigationTarget={() => document.getElementById("main-content")}
    class="group/menu md:hidden"
  >
    {/* A summary cannot hold a button, so it shows the button's look as a badge. */}
    <Menu.Trigger
      aria-label="Navigation"
      class="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 cursor-pointer list-none rounded-lg focus-visible:(outline outline-2 outline-tertiary) [&::-webkit-details-marker]:hidden"
    >
      <Button badge color="contrast" variant="outlined" text="softer" class="p-1.5">
        <span aria-hidden="true" class="i-lucide:menu h-5 w-5 group-open/menu:hidden" />
        <span aria-hidden="true" class="i-lucide:x hidden h-5 w-5 group-open/menu:block" />
      </Button>
    </Menu.Trigger>
    {/* The last row lines up with the menu button, so the button never covers menu items. */}
    <Menu.Content class="fixed inset-0 z-30 flex flex-col gap-6 overflow-y-auto bg-gray-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      <a href={props.page.site.href} class="text-gray-900">
        <Logo site={props.page.site} />
      </a>
      <Show when={props.sections.length || props.page.links.length}>
        <NavigationLinks sections={props.sections} links={props.page.links} />
      </Show>
      <NavigationTree
        items={props.page.navigation}
        storageKey={props.storageKey}
        defaultDepth={2}
      />
      <PoweredBy class="mt-auto h-8 shrink-0" />
    </Menu.Content>
  </Menu.Root>
);

export { MobileNavigation };
