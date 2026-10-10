import { highlightCode } from "@andesine/editor/highlight-code";
import { IconButton, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { type Component, For, Show } from "solid-js";
import { useClipboard } from "#web/context/clipboard";
import type { WebhookEventDetails } from "#web/lib/data";
import clsx from "clsx";

interface PayloadViewProps {
  payload: WebhookEventDetails["payload"];
  class?: string;
}

const tokenColors: Record<string, string> = {
  tag: "text-[var(--syntax-tag)]",
  property: "text-[var(--syntax-property)]",
  value: "text-[var(--syntax-value)]",
  string: "text-[var(--syntax-string)]",
  literal: "text-[var(--syntax-literal)]",
  punctuation: "text-[var(--syntax-punctuation)]"
};

const PayloadView: Component<PayloadViewProps> = (props) => {
  const { copyText } = useClipboard();
  const source = () => {
    return props.payload.availability === "available"
      ? JSON.stringify(props.payload.event, null, 2)
      : "";
  };
  const tokens = createAsync(async () => (source() ? highlightCode(source(), "json") : []));

  return (
    <div class={clsx("flex flex-col", props.class)}>
      <Show
        when={source()}
        fallback={
          <div class="flex h-6 items-center gap-1.5 text-xs">
            <div class="i-lucide:lock h-4 w-4 shrink-0 text-gray-400" />
            Payload hidden. Read access to this event's content is required
          </div>
        }
      >
        <div class="group/payload relative">
          <div class="max-h-[60vh] overflow-auto whitespace-pre font-mono text-xs scrollbar-contrast">
            <For each={tokens.latest} fallback={source()}>
              {(token) => <span class={tokenColors[token.kind]}>{token.text}</span>}
            </For>
          </div>
          <Tooltip
            content="Copy payload"
            wrapperClass="!absolute right-0 top-0 focus-within:opacity-100 media-mouse:opacity-0 media-mouse:group-hover/payload:opacity-100"
            fixed
          >
            <IconButton
              icon="i-lucide:copy"
              variant="ghost"
              size="xs"
              onClick={() => {
                void copyText(source(), {
                  success: "Payload copied to clipboard",
                  fallback: { title: "Copy payload manually" }
                });
              }}
            />
          </Tooltip>
        </div>
      </Show>
    </div>
  );
};

export { PayloadView };
