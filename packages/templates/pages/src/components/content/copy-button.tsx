import { createClipboard } from "@andesine/ui/solid";
import type { Component } from "solid-js";
import { IconButton } from "../primitives/button";

interface CopyButtonProps {
  /** Copied in place of the closest code block. */
  text?: string;
  label?: string;
}

/** Copies `text`, or the visible code block inside the closest `[data-code]` element. */
const CopyButton: Component<CopyButtonProps> = (props) => {
  const clipboard = createClipboard();
  const icon = (): string => {
    if (clipboard.status() === true) return "i-lucide:check";
    if (clipboard.status() === false) return "i-lucide:x";

    return "i-lucide:copy";
  };
  const copy = (event: MouseEvent): void => {
    if (props.text !== undefined) {
      void clipboard.copy(props.text);

      return;
    }

    const root = (event.currentTarget as HTMLElement).closest("[data-code], [data-code-group]");
    const pre = Array.from(root?.querySelectorAll("pre") ?? []).find((element) => {
      return element.getClientRects().length > 0;
    });

    if (pre) void clipboard.copy(pre.textContent ?? "");
  };

  return (
    <>
      <IconButton
        icon={icon()}
        variant="ghost"
        size="xs"
        text="softer"
        aria-label={props.label ?? "Copy code"}
        onClick={copy}
      />
      <span role="status" class="sr-only">
        {clipboard.status() === true ? "Copied" : ""}
        {clipboard.status() === false ? "Copy failed" : ""}
      </span>
    </>
  );
};

export { CopyButton };
