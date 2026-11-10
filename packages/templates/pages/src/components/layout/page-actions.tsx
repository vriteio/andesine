import type { OpenInLink, PageActionsContext } from "@andesine/pages";
import { type CopyResult, createPageActions } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component } from "solid-js";
import { Button, IconButton } from "../primitives/button";
import { Menu, type MenuEntry } from "../primitives/menu";

interface PageActionsProps {
  actions: PageActionsContext;
  /** URL of the page's Markdown alternative. */
  markdown: string;
}

const serviceIcons: Record<OpenInLink["id"], string> = {
  chatgpt: "i-simple-icons:openai",
  claude: "i-simple-icons:claude",
  perplexity: "i-simple-icons:perplexity"
};

const getStatus = (result?: CopyResult): { icon: string; label: string } => {
  if (!result) return { icon: "i-lucide:copy", label: "Copy page" };
  if (!result.success) return { icon: "i-lucide:triangle-alert", label: "Copy failed" };

  return { icon: "i-lucide:check", label: result.item === "link" ? "Link copied" : "Copied" };
};
/** Copies the page as Markdown, with a menu of other actions for the page. */
const PageActions: Component<PageActionsProps> = (props) => {
  const actions = createPageActions({ markdown: props.markdown });
  const status = (): ReturnType<typeof getStatus> => getStatus(actions.result());
  const items = (): MenuEntry[] => [
    { value: "copy-link", label: "Copy link", icon: "i-lucide:link", onSelect: actions.copyLink },
    {
      value: "view-markdown",
      label: "View as Markdown",
      icon: "i-simple-icons:markdown",
      href: props.markdown
    },
    ...(props.actions.openIn.length
      ? ([
          { type: "separator" },
          { type: "header", label: "Open in" },
          ...props.actions.openIn.map((link) => ({
            value: link.id,
            label: link.label,
            icon: serviceIcons[link.id],
            href: link.href,
            target: "_blank"
          }))
        ] satisfies MenuEntry[])
      : [])
  ];

  return (
    <div class="flex shrink-0 gap-1">
      <Button
        variant="secondary"
        text="base"
        class="gap-1.5"
        aria-label="Copy page as Markdown"
        onClick={() => actions.copyMarkdown()}
      >
        <span aria-hidden="true" class={clsx("h-4 w-4 shrink-0 text-gray-400", status().icon)} />
        <span aria-live="polite" class="max-sm:sr-only">
          {status().label}
        </span>
      </Button>
      <Menu
        items={items()}
        trigger={(triggerProps) => (
          <IconButton
            {...triggerProps()}
            icon="i-lucide:chevron-down"
            aria-label="More page actions"
          />
        )}
      />
    </div>
  );
};

export { PageActions };
