import { links } from "../../links";
import { Button, IconButton } from "@andesine/components/primitives";
import { type Component, For } from "solid-js";

const footerLinks = [
  { label: "Changelog", href: links.changelog },
  { label: "Support", href: links.legal.support },
  { label: "Privacy policy", href: links.legal.privacy },
  { label: "Terms of service", href: links.legal.terms }
];

const SiteFooter: Component = () => (
  <footer class="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-8 pt-10 text-gray-500 md:px-8">
    <div class="flex flex-col items-center gap-2 md:flex-row md:justify-between">
      <nav aria-label="Social links" class="flex items-center gap-1">
        <IconButton
          link={links.email}
          icon="i-lucide:mail"
          aria-label="Email Andesine"
          variant="ghost"
          text="softer"
          size="medium"
        />
        <IconButton
          link={links.social.x}
          icon="i-mdi:twitter"
          aria-label="Andesine on X"
          variant="ghost"
          text="softer"
          size="medium"
          target="_blank"
        />
        <IconButton
          link={links.social.linkedin}
          icon="i-mdi:linkedin"
          aria-label="Andesine on LinkedIn"
          variant="ghost"
          text="softer"
          size="medium"
          target="_blank"
        />
        <IconButton
          link={links.repository}
          icon="i-mdi:github"
          aria-label="Andesine on GitHub"
          variant="ghost"
          text="softer"
          size="medium"
          target="_blank"
        />
      </nav>
      <nav
        aria-label="Footer links"
        class="flex flex-wrap items-center justify-center gap-1 md:justify-end"
      >
        <For each={footerLinks}>
          {(link) => (
            <Button link={link.href} target="_blank" variant="ghost" text="softer" size="medium">
              {link.label}
            </Button>
          )}
        </For>
      </nav>
    </div>
    <div class="flex flex-col items-center gap-1 text-sm md:items-start">
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
