import { type Accessor, createSignal, onCleanup } from "solid-js";

interface Clipboard {
  /** `true` after a copy, `false` after a failure, and `undefined` otherwise. */
  status: Accessor<boolean | undefined>;
  /** Copies text; pending text is still written during the click, e.g. text to fetch. */
  copy(text: string | Promise<string>): Promise<void>;
}

/** Copies text, and reports the result for a short time. */
const createClipboard = (timeout = 2000): Clipboard => {
  const [status, setStatus] = createSignal<boolean>();

  let timer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => clearTimeout(timer));

  return {
    status,
    copy: async (text) => {
      clearTimeout(timer);

      try {
        // Safari allows a write only during the click, so pending text gets a pending item.
        if (typeof text !== "string" && typeof ClipboardItem !== "undefined") {
          const blob = text.then((value) => new Blob([value], { type: "text/plain" }));

          await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
        } else {
          await navigator.clipboard.writeText(await text);
        }

        setStatus(true);
      } catch {
        setStatus(false);
      }

      timer = setTimeout(() => setStatus(undefined), timeout);
    }
  };
};

export { createClipboard };
export type { Clipboard };
