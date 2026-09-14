import { links } from "../../links";
import { Logo } from "@andesine/components/fragments";
import { Button, IconButton, Tooltip } from "@andesine/components/primitives";
import { type Component, createSignal, For } from "solid-js";

const navigation = [
  { label: "Workspace", href: links.sections.editor },
  { label: "Features", href: links.sections.features },
  { label: "Pricing", href: links.sections.pricing },
  { label: "Docs", href: links.documentation.home }
];

// Port of the Vrite landing page's compact, fixed navigation.
const SiteHeader: Component = () => {
  const [menuOpened, setMenuOpened] = createSignal(false);
  const closeMenu = (): void => {
    setMenuOpened(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        aria-hidden={!menuOpened()}
        inert={!menuOpened()}
        tabIndex={-1}
        data-open={menuOpened()}
        class="pointer-events-none fixed inset-0 z-30 bg-gray-50/20 opacity-0 backdrop-blur-0 transition-[opacity,backdrop-filter] duration-250 ease-out data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 data-[open=true]:backdrop-blur-sm motion-reduce:transition-none md:hidden"
        onClick={closeMenu}
      />
      <header class="fixed inset-x-0 top-0 z-40 mx-auto w-full md:top-2 md:max-w-3xl md:px-3 xl:max-w-4xl">
        <div class="overflow-hidden bg-gray-50 pt-[env(safe-area-inset-top)] md:rounded-2xl md:bg-gray-50/85 md:pt-0 md:backdrop-blur-xl">
          <div class="flex min-h-14 items-center justify-between gap-3 px-3">
            <a href={links.sections.home} aria-label="Andesine home" onClick={closeMenu}>
              <Logo />
            </a>
            <nav aria-label="Main navigation" class="hidden items-center gap-1 md:flex">
              <For each={navigation}>
                {(link) => (
                  <Button link={link.href} variant="text" hover="underline">
                    {link.label}
                  </Button>
                )}
              </For>
            </nav>
            <div class="hidden items-center gap-2 md:flex">
              <Tooltip content="Star on GitHub" fixed>
                <IconButton link={links.repository} variant="text" icon="i-mdi:github" />
              </Tooltip>
              <IconButton
                color="primary"
                class="flex-row-reverse gap-1 pr-1.5"
                icon="i-lucide:log-in"
                iconProps={{ class: "h-5 w-5 opacity-50" }}
                label="Sign in"
                variant="outlined"
                link={links.cloudApp}
              >
                Sign in
              </IconButton>
            </div>
            <IconButton
              icon={menuOpened() ? "i-lucide:x" : "i-lucide:menu"}
              aria-label={menuOpened() ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpened()}
              aria-controls="mobile-navigation"
              variant="text"
              class="md:hidden"
              onClick={() => setMenuOpened(!menuOpened())}
            />
          </div>
          <div
            id="mobile-navigation"
            data-open={menuOpened()}
            aria-hidden={!menuOpened()}
            inert={!menuOpened()}
            class="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-250 ease-out data-[open=true]:grid-rows-[1fr] data-[open=true]:opacity-100 motion-reduce:transition-none md:hidden"
          >
            <div class="min-h-0 overflow-hidden">
              <nav aria-label="Mobile navigation" class="flex flex-col gap-1 p-3">
                <For each={navigation}>
                  {(link) => (
                    <Button link={link.href} variant="text" onClick={closeMenu}>
                      {link.label}
                    </Button>
                  )}
                </For>
                <Button link={links.repository} variant="text" onClick={closeMenu}>
                  GitHub
                </Button>
                <Button link={links.cloudSignUp} color="primary" onClick={closeMenu}>
                  Start writing
                </Button>
              </nav>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export { SiteHeader };
