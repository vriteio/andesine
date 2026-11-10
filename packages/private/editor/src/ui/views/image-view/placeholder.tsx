import { AnimatedGradientCard } from "@andesine/components";
import { Show } from "solid-js";
import clsx from "clsx";

interface ImagePlaceholderProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: boolean;
  action?: string;
  onAction?(): void;
}

const ImagePlaceholder = (props: ImagePlaceholderProps) => (
  <AnimatedGradientCard class="image-placeholder-card @container/image absolute inset-0 h-full w-full rounded-xl isolate overflow-hidden">
    <div
      class="flex h-full w-full flex-col items-center justify-center overflow-hidden p-2 text-center"
      aria-label={props.description ? `${props.title}. ${props.description}` : props.title}
      role={props.error ? "alert" : "status"}
    >
      <span
        class={clsx(
          "h-6 w-6 shrink-0",
          props.loading
            ? "i-lucide:loader-circle animate-spin"
            : props.error
              ? "i-lucide:image-off"
              : "i-lucide:image-plus"
        )}
      />
      <div class="hidden @xs/image:flex max-w-full flex-col items-center">
        <span class="text-sm font-medium mt-1">{props.title}</span>
        <Show when={props.description}>
          <span class="max-w-full text-xs text-white/70 break-words line-clamp-2 mb-1">
            {props.description}
          </span>
        </Show>
        <Show when={props.action}>
          <button
            type="button"
            class="rounded-md outline outline-1 -outline-offset-0.5 outline-white/80 bg-white/10 px-1.5 py-0.5 text-sm text-white shadow-md shadow-white/10 hover:bg-white/20"
            onClick={props.onAction}
          >
            {props.action}
          </button>
        </Show>
      </div>
      <Show when={props.action}>
        <button
          type="button"
          class="absolute inset-0 h-full w-full rounded-xl focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          aria-label={props.action}
          onClick={props.onAction}
        />
      </Show>
    </div>
  </AnimatedGradientCard>
);

export { ImagePlaceholder };
