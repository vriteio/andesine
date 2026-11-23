import clsx from "clsx";
import type { JSONContent } from "@tiptap/core";
import { type Component, For, type JSX, Match, Switch } from "solid-js";
import { parseComment } from "./markdown";

interface CommentTextProps {
  content: string;
  class?: string;
}

/** Shared with the comment field, so comments look as written. */
const MARK_CLASSES: Record<string, string> = {
  bold: "font-semibold",
  italic: "italic",
  strike: "line-through",
  // Shows on the focused field too.
  code: "rounded bg-gray-200 px-1 font-mono text-[90%]",
  link: "underline decoration-gray-300"
};

const renderText = (node: JSONContent): JSX.Element => {
  const href = node.marks?.find(({ type }) => type === "link")?.attrs?.href as string | undefined;
  const text = (
    <span class={clsx(node.marks?.map(({ type }) => MARK_CLASSES[type]))}>{node.text}</span>
  );

  if (!href) return text;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" class={MARK_CLASSES.link}>
      {text}
    </a>
  );
};
/** Renders elements, never HTML from the comment. */
const CommentText: Component<CommentTextProps> = (props) => {
  const nodes = () => parseComment(props.content).content?.[0]?.content ?? [];

  return (
    <p class={clsx("m-0 text-sm text-gray-700 whitespace-pre-wrap break-words", props.class)}>
      <For each={nodes()}>
        {(node) => (
          <Switch fallback={renderText(node)}>
            <Match when={node.type === "hardBreak"}>
              <br />
            </Match>
          </Switch>
        )}
      </For>
    </p>
  );
};

export { CommentText, MARK_CLASSES };
