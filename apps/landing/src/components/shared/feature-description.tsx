import { type Component, type JSX, Show } from "solid-js";
import clsx from "clsx";

interface FeatureContentProps {
  title: string;
  text: string;
}

interface FeatureDescriptionProps extends FeatureContentProps {
  marker?: JSX.Element;
  class?: string;
}

const FeatureDescription: Component<FeatureDescriptionProps> = (props) => (
  <div class={props.class}>
    <Show when={props.marker}>
      <div aria-hidden="true" class="flex items-center gap-3">
        {props.marker}
        <span class="h-px flex-1 bg-gray-200" />
      </div>
    </Show>
    <h3 class={clsx("text-xl font-medium", props.marker && "mt-2")}>{props.title}</h3>
    <p class="mt-2 text-base leading-relaxed text-gray-500">{props.text}</p>
  </div>
);

export { FeatureDescription, type FeatureContentProps };
