import { Button } from "@andesine/components/primitives";
import { type Component, Show } from "solid-js";
import clsx from "clsx";

interface ActionButtonProps {
  link: string;
  title: string;
  description: string;
  icon: string;
  primary?: boolean;
  entryDelay?: number;
}

const ActionButton: Component<ActionButtonProps> = (props) => (
  <div data-entry="up" data-entry-delay={props.entryDelay}>
    <Button
      link={props.link}
      color={props.primary ? "primary" : "contrast"}
      variant={props.primary ? "solid" : "outlined"}
      class="relative flex h-full w-full flex-col items-start justify-start overflow-hidden rounded-2xl px-4 py-3 text-left md:px-6 md:py-4"
    >
      <Show when={props.primary}>
        {/* Same subtle noise treatment as the billing upgrade button. */}
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 bg-repeat bg-[url(/assets/noise.png)] mix-blend-overlay bg-blend-overlay"
          style={{ "background-size": "6rem 6rem" }}
        />
      </Show>
      <span class="relative flex w-full items-center gap-3">
        <span
          aria-hidden="true"
          class={clsx("h-6 w-6 shrink-0", props.icon, !props.primary && "text-gray-500")}
        />
        <span class="text-xl font-medium md:text-2xl">{props.title}</span>
        <span
          aria-hidden="true"
          class={clsx(
            "i-lucide:arrow-up-right ml-auto h-5 w-5 shrink-0",
            props.primary ? "opacity-70" : "text-gray-400"
          )}
        />
      </span>
      <span
        class={clsx(
          "relative mt-2 w-full text-left text-base font-normal leading-relaxed",
          props.primary ? "text-white/80" : "text-gray-500"
        )}
      >
        {props.description}
      </span>
    </Button>
  </div>
);

export { ActionButton };
