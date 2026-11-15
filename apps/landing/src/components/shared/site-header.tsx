import { links } from "../../links";
import { menuGroups, menuLinks, type NavigationGroup } from "../../navigation";
import { Logo } from "@andesine/components/fragments";
import { Button, Card, IconButton, Tooltip } from "@andesine/components/primitives";
import { type Component, createSignal, For, Show } from "solid-js";
import clsx from "clsx";

interface MenuCardPosition {
  left: number;
  width: number;
  height: number;
}

// Port of the Vrite landing page's compact, fixed navigation.
const SiteHeader: Component = () => {
  const [menuOpened, setMenuOpened] = createSignal(false);
  const [openedGroup, setOpenedGroup] = createSignal<NavigationGroup | null>(null);
  const [menuCard, setMenuCard] = createSignal<MenuCardPosition>({ left: 0, width: 0, height: 0 });
  const [menuCardMoving, setMenuCardMoving] = createSignal(false);
  const groupPanels = new Map<NavigationGroup, HTMLElement>();

  let headerRef: HTMLElement | undefined;

  const closeMenu = (): void => {
    setMenuOpened(false);
    setOpenedGroup(null);
  };
  // Moving between groups slides and resizes the open card; opening from closed places it at once.
  const openGroup = (group: NavigationGroup, trigger: HTMLElement): void => {
    const headerRect = headerRef?.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const triggerCenter = triggerRect.left + triggerRect.width / 2 - (headerRect?.left || 0);
    const panel = groupPanels.get(group);
    const width = panel?.offsetWidth || 0;
    const maxLeft = (headerRect?.width || 0) - width;

    setMenuCardMoving(Boolean(openedGroup()));
    setMenuCard({
      left: Math.max(0, Math.min(triggerCenter - width / 2, maxLeft)),
      width,
      height: panel?.offsetHeight || 0
    });
    setOpenedGroup(group);
  };
  const handleFocusOut = (event: FocusEvent): void => {
    const header = event.currentTarget as HTMLElement;

    if (!header.contains(event.relatedTarget as Node | null)) setOpenedGroup(null);
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
      <header
        ref={headerRef}
        onMouseLeave={() => setOpenedGroup(null)}
        onFocusOut={handleFocusOut}
        onKeyDown={(event) => event.key === "Escape" && closeMenu()}
        class="fixed inset-x-0 top-0 z-40 mx-auto w-full md:top-2 md:max-w-3xl md:px-3 xl:max-w-4xl"
      >
        <div class="overflow-hidden bg-gray-50 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] md:rounded-2xl md:bg-gray-50/85 md:p-0 md:backdrop-blur-xl">
          <div class="flex min-h-14 items-center justify-between gap-3 px-3">
            <a href={links.pages.home} aria-label="Andesine home" onClick={closeMenu}>
              <Logo />
            </a>
            <nav aria-label="Main navigation" class="hidden items-center gap-1 md:flex">
              <For each={menuGroups}>
                {(group) => (
                  <Button
                    variant="ghost"
                    size="medium"
                    class="flex items-center gap-1"
                    aria-expanded={openedGroup() === group}
                    aria-controls="menu-group"
                    onMouseEnter={(event) => openGroup(group, event.currentTarget)}
                    onClick={(event) => openGroup(group, event.currentTarget)}
                  >
                    {group.label}
                    <span
                      aria-hidden="true"
                      class="i-lucide:chevron-down h-4 w-4 opacity-50 transition-transform data-[open=true]:rotate-180"
                      data-open={openedGroup() === group}
                    />
                  </Button>
                )}
              </For>
              <For each={menuLinks}>
                {(link) => (
                  <Button
                    link={link.href}
                    variant="ghost"
                    size="medium"
                    onMouseEnter={() => setOpenedGroup(null)}
                  >
                    {link.label}
                  </Button>
                )}
              </For>
            </nav>
            <div class="hidden items-center gap-2 md:flex">
              <Tooltip content="Star on GitHub" fixed>
                <IconButton
                  link={links.repository}
                  variant="secondary"
                  text="base"
                  size="medium"
                  class="p-1.5"
                  icon="i-mdi:github"
                  iconProps={{ class: "h-5 w-5" }}
                />
              </Tooltip>
              <IconButton
                variant="primary"
                size="medium"
                class="flex-row-reverse gap-1 pr-1.5"
                icon="i-lucide:log-in"
                iconProps={{ class: "h-5 w-5 opacity-50" }}
                label="Sign in"
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
              variant="ghost"
              text="base"
              size="medium"
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
              <nav
                aria-label="Mobile navigation"
                class="flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto p-3"
              >
                <For each={menuGroups}>
                  {(group) => (
                    <>
                      <span class="px-2 pt-2 text-sm text-gray-400">{group.label}</span>
                      <For each={group.links}>
                        {(link) => (
                          <Button
                            link={link.href}
                            variant="ghost"
                            size="medium"
                            class="flex items-center gap-2"
                            onClick={closeMenu}
                          >
                            <Show when={link.icon}>
                              <span
                                aria-hidden="true"
                                class={clsx(link.icon, "h-4 w-4 opacity-50")}
                              />
                            </Show>
                            {link.label}
                          </Button>
                        )}
                      </For>
                    </>
                  )}
                </For>
                <span class="px-2 pt-2 text-sm text-gray-400">More</span>
                <For each={menuLinks}>
                  {(link) => (
                    <Button link={link.href} variant="ghost" size="medium" onClick={closeMenu}>
                      {link.label}
                    </Button>
                  )}
                </For>
                <Button link={links.repository} variant="ghost" size="medium" onClick={closeMenu}>
                  GitHub
                </Button>
                <Button link={links.cloudSignUp} size="medium" onClick={closeMenu}>
                  Start writing
                </Button>
              </nav>
            </div>
          </div>
        </div>
        <div
          id="menu-group"
          data-open={Boolean(openedGroup())}
          aria-hidden={!openedGroup()}
          inert={!openedGroup()}
          class="pointer-events-none absolute left-0 top-full hidden -translate-y-1 pt-2 opacity-0 transition-[opacity,transform] duration-200 ease-out data-[open=true]:pointer-events-auto data-[open=true]:translate-y-0 data-[open=true]:opacity-100 motion-reduce:transition-none md:block"
        >
          <Card
            shade
            class={clsx(
              "relative overflow-hidden bg-white! p-0 ease-out motion-reduce:transition-none",
              menuCardMoving() && "transition-[transform,width,height] duration-250"
            )}
            style={{
              transform: `translateX(${menuCard().left}px)`,
              width: `${menuCard().width}px`,
              height: `${menuCard().height}px`
            }}
          >
            <For each={menuGroups}>
              {(group) => (
                <div
                  ref={(element) => groupPanels.set(group, element)}
                  inert={openedGroup() !== group}
                  data-active={openedGroup() === group}
                  class="absolute left-0 top-0 w-max p-2 opacity-0 transition-opacity duration-200 data-[active=true]:opacity-100"
                >
                  <Show
                    when={group.sections}
                    fallback={
                      <div class="flex flex-col">
                        <span class="px-2 pb-1 pt-1 text-xs text-gray-400">{group.label}</span>
                        <ul class="grid grid-cols-2 gap-1">
                          <For each={group.links}>
                            {(link) => (
                              <li>
                                <a
                                  href={link.href}
                                  class="flex w-64 flex-col rounded-xl px-2 py-1 @hover:bg-gradient-to-r @hover:from-gray-500/10 @hover:to-transparent"
                                  onClick={closeMenu}
                                >
                                  <span class="font-medium">{link.label}</span>
                                  <span class="text-sm text-gray-500">{link.description}</span>
                                </a>
                              </li>
                            )}
                          </For>
                        </ul>
                      </div>
                    }
                  >
                    {(sections) => (
                      <div class="flex gap-2">
                        <For each={sections()}>
                          {(section) => (
                            <div class="flex w-48 flex-col">
                              <span class="px-2 pb-1 pt-1 text-xs text-gray-400">
                                {section.label}
                              </span>
                              <ul class="flex flex-col">
                                <For each={section.links}>
                                  {(link) => (
                                    <li>
                                      <a
                                        href={link.href}
                                        class="group relative isolate flex items-center gap-2 rounded-lg px-2 py-1 font-medium outline-none"
                                        onClick={closeMenu}
                                      >
                                        <span
                                          aria-hidden="true"
                                          class="pointer-events-none absolute inset-0 -z-1 rounded-lg bg-gradient-to-r from-secondary via-primary to-transparent opacity-0 transition-opacity media-mouse:group-hover:opacity-10 group-focus-visible:opacity-10"
                                        />
                                        <span
                                          aria-hidden="true"
                                          class={clsx(link.icon, "h-5 w-5 bg-gradient-to-tr")}
                                        />
                                        {link.label}
                                      </a>
                                    </li>
                                  )}
                                </For>
                              </ul>
                            </div>
                          )}
                        </For>
                      </div>
                    )}
                  </Show>
                </div>
              )}
            </For>
          </Card>
        </div>
      </header>
    </>
  );
};

export { SiteHeader };
