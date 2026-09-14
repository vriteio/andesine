import { links } from "../../links";
import { Button, IconButton } from "@andesine/components/primitives";
import { type Component } from "solid-js";

const SiteFooter: Component = () => (
  <footer class="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 pb-8 pt-10 text-gray-500 md:px-8">
    <nav aria-label="Social links" class="flex items-center justify-center gap-1 md:justify-start">
      <IconButton
        link={links.email}
        icon="i-lucide:mail"
        aria-label="Email Andesine"
        variant="text"
        text="softer"
      />
      <IconButton
        link={links.social.x}
        icon="i-mdi:twitter"
        aria-label="Andesine on X"
        variant="text"
        text="softer"
        target="_blank"
      />
      <IconButton
        link={links.social.linkedin}
        icon="i-mdi:linkedin"
        aria-label="Andesine on LinkedIn"
        variant="text"
        text="softer"
        target="_blank"
      />
      <IconButton
        link={links.repository}
        icon="i-mdi:github"
        aria-label="Andesine on GitHub"
        variant="text"
        text="softer"
        target="_blank"
      />
    </nav>
    <div class="mt-4 flex flex-col items-center gap-1 text-base md:flex-row">
      <span>© {new Date().getFullYear()} Andesine. All rights reserved.</span>
      <div class="flex-1" />
      <nav aria-label="Legal links" class="flex items-center gap-1">
        <Button
          link={links.legal.privacy}
          target="_blank"
          variant="text"
          hover="underline"
          text="softer"
        >
          Privacy policy
        </Button>
        <Button
          link={links.legal.terms}
          target="_blank"
          variant="text"
          hover="underline"
          text="softer"
        >
          Terms of service
        </Button>
      </nav>
    </div>
  </footer>
);

export { SiteFooter };
