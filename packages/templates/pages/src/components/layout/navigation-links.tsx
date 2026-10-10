import type { IconLinkConfig, SectionContext } from "@andesine/pages";
import clsx from "clsx";
import { type Component, For } from "solid-js";

interface NavigationLinksProps {
  /** Sections, when they show in the navigation in place of header tabs. */
  sections?: SectionContext[];
  links: IconLinkConfig[];
  class?: string;
}

interface NavigationLinkProps {
  href: string;
  label: string;
  icon: string;
  current?: boolean;
}

const NavigationLink: Component<NavigationLinkProps> = (props) => (
  <a
    href={props.href}
    aria-current={props.current ? "location" : undefined}
    class="group flex items-center gap-2 font-medium text-gray-700"
  >
    <span
      class={clsx(
        "flex shrink-0 items-center justify-center rounded-lg p-1 shadow-md outline outline-1 -outline-offset-1 transition-[background-position,background-color] duration-200 ease-out text-gray-500",
        props.current
          ? "bg-gradient-to-tr bg-[length:125%_auto] text-white outline-tertiary group-hover:bg-right group-focus-visible:bg-right"
          : "bg-white shadow-gray-200 outline-gray-200 group-hover:bg-gray-100 group-focus-visible:bg-gray-100"
      )}
    >
      <span aria-hidden="true" class={clsx("h-5 w-5", props.icon)} />
    </span>
    {props.label}
  </a>
);
/** Links at the top of the navigation: the sections, then the configured links. */
const NavigationLinks: Component<NavigationLinksProps> = (props) => (
  <nav aria-label="Links" class={clsx(":base: flex flex-col gap-2", props.class)}>
    <For each={props.sections}>
      {(section) => (
        <NavigationLink
          href={section.href}
          label={section.label}
          icon={section.icon ?? "i-lucide:book-open"}
          current={section.current}
        />
      )}
    </For>
    <For each={props.links}>
      {(link) => <NavigationLink href={link.href} label={link.label} icon={link.icon} />}
    </For>
  </nav>
);

export { NavigationLinks };
