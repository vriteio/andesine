import clsx from "clsx";
import { type Component, createSignal, onMount, Show } from "solid-js";
import {
  Card,
  IconButton,
  LinkInput,
  Shortcut,
  Tooltip,
  createRef,
  getLinkedEntryID
} from "@andesine/components";
import { type ChainedCommands, type Editor } from "@tiptap/core";
import { validateURL } from "@andesine/document/tiptap";
import type { EditorLinks } from "#editor/client-types";

interface LinkMenuProps {
  editor: Editor;
  links?: EditorLinks;
  class?: string;
  opened?: boolean;
  /** Changes the whole link around the cursor, not the selection, e.g. from the link's menu. */
  cursorLink?: boolean;
  setMode(mode: string): void;
}

const LinkMenu: Component<LinkMenuProps> = (props) => {
  const initialHref: string = props.editor.getAttributes("link").href || "";
  const [url, setUrl] = createSignal(initialHref);
  const [invalid, setInvalid] = createSignal(false);
  const [inputRef, setInputRef] = createRef<HTMLInputElement | null>(null);
  const [cardRef, setCardRef] = createRef<HTMLElement | null>(null);
  const hasLink = Boolean(initialHref);
  const entries = () => props.links?.entries() ?? [];
  // The field shows an entry link as the entry's title.
  const shownText = () => {
    const entryID = getLinkedEntryID(url());

    return (entryID && entries().find(({ id }) => id === entryID)?.title) || url();
  };
  // A link around the cursor is changed as a whole, and the cursor stays where it was.
  const cursor = props.editor.state.selection.from;
  const changeLink = (change: (chain: ChainedCommands) => ChainedCommands) => {
    const chain = props.editor.chain();
    const changed = change(props.cursorLink ? chain.extendMarkRange("link") : chain);

    (props.cursorLink ? changed.setTextSelection(cursor) : changed).focus().run();
  };
  const saveLink = (chosenHref?: string): void => {
    const text = inputRef()?.value.trim() ?? "";
    const href = chosenHref ?? validateURL(text === shownText() ? url() : text);

    if (!href) {
      setInvalid(true);
      inputRef()?.focus();

      return;
    }

    changeLink((chain) => chain.unsetCode().setLink({ href }));
    props.setMode("format");
  };
  const removeLink = (): void => {
    changeLink((chain) => chain.unsetLink());
    props.setMode("format");
  };

  onMount(() => {
    setTimeout(() => inputRef()?.focus(), 50);
  });

  return (
    <Card
      ref={setCardRef}
      data-menu="link"
      class={clsx(
        "relative flex w-full max-w-full p-1 gap-1 rounded-none overflow-x-auto scrollbar-hidden items-center not-prose bg-white md:w-auto md:max-w-none md:rounded-xl md:overflow-visible",
        props.class
      )}
      shade
    >
      <Tooltip
        content={
          <div class="flex flex-col items-center justify-center gap-0.5">
            <span>Go back</span>
          </div>
        }
        placement="bottom"
        wrapperClass="snap-start shrink-0"
        enabled={props.opened}
      >
        <IconButton
          icon="i-lucide:arrow-left"
          variant="ghost"
          text="base"
          size="xs"
          onClick={(event) => {
            props.setMode("format");
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      </Tooltip>
      <LinkInput
        ref={setInputRef}
        value={url()}
        entries={entries()}
        toHref={validateURL}
        placeholder="Search entries or enter a URL..."
        error={
          invalid()
            ? "Choose an entry, or enter a URL. Links can use HTTP, HTTPS, or mailto."
            : undefined
        }
        anchor={cardRef}
        defaultOpen={Boolean(getLinkedEntryID(initialHref))}
        class="w-56 flex-1"
        setValue={(href) => {
          setUrl(href);
          setInvalid(false);
          saveLink(href);
        }}
        onInvalid={() => saveLink()}
      />
      <Tooltip
        content={
          <div class="flex flex-col items-center justify-center gap-0.5">
            <span>Save link</span>
            <Shortcut class="opacity-50 font-mono text-[80%]" shortcut="enter" />
          </div>
        }
        enabled={props.opened}
        placement="bottom"
      >
        <IconButton
          icon="i-lucide:check"
          variant="ghost"
          text="base"
          size="xs"
          onClick={(event) => {
            saveLink();
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      </Tooltip>
      <Show when={hasLink}>
        <Tooltip
          content={
            <div class="flex flex-col items-center justify-center gap-0.5">
              <span>Remove link</span>
            </div>
          }
          placement="bottom"
          wrapperClass="snap-start shrink-0"
          enabled={props.opened}
        >
          <IconButton
            icon="i-lucide:trash-2"
            variant="ghost"
            text="base"
            size="xs"
            onClick={(event) => {
              removeLink();
              event.preventDefault();
              event.stopPropagation();
            }}
          />
        </Tooltip>
      </Show>
    </Card>
  );
};

export { LinkMenu };
