import type { SiteContext } from "@andesine/pages";
import clsx from "clsx";
import { type Component, Show } from "solid-js";

interface LogoProps {
  site: SiteContext;
  class?: string;
}

/**
 * The configured logo and the site name: a square icon next to the name, or a full logo and a
 * bar before the name. Without a logo, the name only.
 */
const Logo: Component<LogoProps> = (props) => {
  const full = (): boolean => props.site.logo?.format === "full";
  const showName = (): boolean => !props.site.logo || props.site.logo.title;
  // The name follows as text, so a logo image repeats only the text in the image.
  const alt = (): string => props.site.logo?.alt ?? (showName() ? "" : props.site.name);

  return (
    <span class={clsx(":base: flex min-w-0 items-center gap-3 text-2xl font-bold", props.class)}>
      <Show when={props.site.logo}>
        {(logo) => (
          <img
            src={logo().src}
            alt={alt()}
            class={full() ? "h-6.5 w-auto shrink-0" : "h-8 w-8 shrink-0"}
          />
        )}
      </Show>
      <Show when={showName()}>
        <Show when={full()}>
          <span aria-hidden="true" class="h-6 w-0.5 shrink-0 rounded-full bg-gray-200" />
        </Show>
        <span class={clsx("truncate", full() && "text-xl font-semibold")}>{props.site.name}</span>
      </Show>
    </span>
  );
};

export { Logo };
