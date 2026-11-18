import { links } from "../../links";
import { footerGroups } from "../../navigation";
import { Logo } from "@andesine/components/fragments";
import { IconButton } from "@andesine/components/primitives";
import { type Component, For } from "solid-js";

const socialLinks = [
  { label: "Email Andesine", href: links.email, icon: "i-lucide:mail" },
  { label: "Andesine on X", href: links.social.x, icon: "i-simple-icons:x" },
  { label: "Andesine on LinkedIn", href: links.social.linkedin, icon: "i-mdi:linkedin" },
  { label: "Andesine on GitHub", href: links.repository, icon: "i-mdi:github" }
];

const SiteFooter: Component = () => (
  <footer class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-8 pt-10 md:px-8">
    <div class="flex items-center justify-between gap-4 border-t border-gray-200 pt-8">
      <a href={links.pages.home} aria-label="Andesine home">
        <Logo />
      </a>
      <nav aria-label="Social links" class="flex items-center gap-1">
        <For each={socialLinks}>
          {(social) => (
            <IconButton
              link={social.href}
              icon={social.icon}
              aria-label={social.label}
              variant="ghost"
              text="softer"
              size="medium"
              class="p-1.5"
              iconProps={{ class: "h-5 w-5" }}
              target={social.href.startsWith("http") ? "_blank" : undefined}
            />
          )}
        </For>
      </nav>
    </div>
    <nav aria-label="Footer links" class="grid grid-cols-2 gap-6 text-gray-500 md:grid-cols-4">
      <For each={footerGroups}>
        {(group) => (
          <div class="flex flex-col gap-2">
            <span class="text-xs text-gray-400">{group.label}</span>
            <ul class="flex flex-col gap-1">
              <For each={group.links}>
                {(link) => (
                  <li>
                    {/* The app's link-button hover: a gradient underline drawn from the left. */}
                    <a
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      class="relative @hover:text-gray-700 focus-visible:text-gray-700 after:absolute after:bottom-px after:left-0 after:h-1px after:w-full after:origin-left after:scale-x-0 after:rounded-lg after:bg-gradient-to-tr after:from-secondary after:via-primary after:to-secondary after:opacity-0 after:transition after:delay-50 after:duration-200 after:ease-out after:content-[''] @hover:after:scale-100 @hover:after:opacity-100 focus-visible:after:scale-100 focus-visible:after:opacity-100"
                    >
                      {link.label}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </For>
    </nav>
    <div class="flex flex-col items-center gap-1 text-sm text-gray-500 md:items-start">
      <span>© {new Date().getFullYear()} Vrite, Inc. All rights reserved.</span>
      <span>
        From the makers of{" "}
        <a
          href={links.vrite}
          target="_blank"
          class="underline decoration-gray-300 underline-offset-4"
        >
          Vrite
        </a>
        .
      </span>
    </div>
  </footer>
);

export { SiteFooter };
