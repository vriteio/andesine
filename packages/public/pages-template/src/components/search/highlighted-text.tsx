import { splitMatches } from "@andesine/ui/solid";
import { type Component, For, Show } from "solid-js";

interface HighlightedTextProps {
  text: string;
  query: string;
}

/** Shows matches of the query with gradient text, as in the Andesine app. */
const HighlightedText: Component<HighlightedTextProps> = (props) => (
  <For each={splitMatches(props.text, props.query)}>
    {(part) => (
      <Show when={part.match} fallback={part.text}>
        <mark class="bg-transparent bg-gradient-to-tr from-secondary via-primary to-secondary bg-clip-text font-medium text-transparent">
          {part.text}
        </mark>
      </Show>
    )}
  </For>
);

export { HighlightedText };
