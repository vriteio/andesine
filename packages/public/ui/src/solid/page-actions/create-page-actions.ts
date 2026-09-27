import { type Accessor, createSignal } from "solid-js";
import { createClipboard } from "../clipboard";

interface PageActionsOptions {
  /** URL of the page's Markdown alternative. */
  markdown: string;
  /** Time that a copy result shows, in milliseconds. */
  timeout?: number;
}

interface PageActions {
  /** The last copy result, for a short time. */
  result: Accessor<CopyResult | undefined>;
  copyLink(): Promise<void>;
  copyMarkdown(): Promise<void>;
}

interface CopyResult {
  item: "link" | "markdown";
  success: boolean;
}

/** Copies the page URL or its Markdown alternative. */
const createPageActions = (options: PageActionsOptions): PageActions => {
  const [item, setItem] = createSignal<CopyResult["item"]>("link");
  const clipboard = createClipboard(options.timeout);

  let markdown: Promise<string> | undefined;

  const loadMarkdown = (): Promise<string> => {
    markdown ??= fetch(options.markdown).then((response) => {
      if (!response.ok) throw new Error(`Markdown request failed (${response.status}).`);

      return response.text();
    });
    markdown.catch(() => (markdown = undefined));

    return markdown;
  };
  const result = (): CopyResult | undefined => {
    const success = clipboard.status();

    return success === undefined ? undefined : { item: item(), success };
  };

  return {
    result,
    copyLink: () => {
      setItem("link");

      return clipboard.copy(window.location.href);
    },
    copyMarkdown: () => {
      setItem("markdown");

      return clipboard.copy(loadMarkdown());
    }
  };
};

export { createPageActions };
export type { PageActionsOptions, CopyResult, PageActions };
