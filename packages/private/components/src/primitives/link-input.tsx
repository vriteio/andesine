import { Combobox as ArkCombobox, createListCollection } from "@ark-ui/solid/combobox";
import clsx from "clsx";
import { createEffect, createMemo, createSignal, For, type JSX, on, Show } from "solid-js";
import { ScrollShadow } from "../fragments/scroll-shadow";
import { createRef } from "../ref";
import { createLinkOptions, type LinkOptionsSource } from "./link-options";
import { Tooltip } from "./tooltip";

interface LinkInputProps extends LinkOptionsSource {
  placeholder?: string;
  class?: string;
  /** Shown with a warning icon, e.g. after the text didn't make a link. */
  error?: string;
  /** Shows the options at first, e.g. the entries when an entry link is edited. */
  defaultOpen?: boolean;
  /** The element that the options line up with, edge to edge, e.g. the menu around the field. */
  anchor(): HTMLElement | null;
  ref?(element: HTMLInputElement): void;
  setValue(href: string): void;
  /** Enter without an option to choose, e.g. for text that is neither an entry nor a URL. */
  onInvalid?(): void;
}

/** The editor's link field: the options are in a card, as the slash menu's. */
const LinkInput = (props: LinkInputProps): JSX.Element => {
  const [query, setQuery] = createSignal<string | null>(null);
  const [opened, setOpened] = createSignal(props.defaultOpen ?? false);
  // As the slash menu, a scrolling list makes room for its scrollbar.
  const [scrolls, setScrolls] = createSignal(false);
  const [listRef, setListRef] = createRef<HTMLElement | null>(null);
  const link = createLinkOptions(props);
  // While not typing, the field shows the link: the entry's title, or the URL.
  const displayValue = () => link.selected()?.label ?? "";
  const options = createMemo(() => link.search(query() ?? ""));
  const collection = createMemo(() => createListCollection({ items: options() }));

  // After layout, e.g. once the list mounts or its options change.
  const measureScroll = () => {
    requestAnimationFrame(() => {
      const list = listRef();

      setScrolls(Boolean(list && list.scrollHeight > list.clientHeight));
    });
  };
  const choose = (href: string) => {
    setQuery(null);
    setOpened(false);
    props.setValue(href);
  };

  createEffect(on(options, measureScroll));

  return (
    <ArkCombobox.Root
      class={clsx(":base: relative flex w-full min-w-0 flex-col", props.class)}
      collection={collection()}
      inputBehavior="autohighlight"
      selectionBehavior="preserve"
      inputValue={query() ?? displayValue()}
      open={opened() && options().length > 0}
      positioning={{
        placement: "bottom-start",
        strategy: "absolute",
        sameWidth: true,
        offset: { mainAxis: 8 },
        getAnchorRect: () => props.anchor()?.getBoundingClientRect() ?? null
      }}
      value={props.value ? [props.value] : []}
      // The list scrolls, not the content, so the keyboard's option is scrolled to there.
      scrollToIndexFn={({ getElement }) => getElement()?.scrollIntoView({ block: "nearest" })}
      onInputValueChange={(details) => {
        if (details.reason === "input-change") {
          setQuery(details.inputValue);
          setOpened(true);
        }
      }}
      onOpenChange={(details) => {
        setOpened(details.open);

        if (!details.open) setQuery(null);
      }}
      onValueChange={(details) => {
        const href = details.value[0];

        if (href) choose(href);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key !== "Enter" || options().length) return;

        event.preventDefault();
        props.onInvalid?.();
      }}
      lazyMount
      unmountOnExit
    >
      <ArkCombobox.Control class=":base: relative flex w-full min-w-0 items-center">
        <ArkCombobox.Input
          ref={props.ref}
          aria-invalid={Boolean(props.error)}
          class={clsx(
            ":base: h-6.5 max-h-6.5 w-full min-w-0 flex-1 rounded-lg bg-gray-50 p-0.5 px-1.5 text-[16px] text-gray-700 shadow-md shadow-gray-900/8 outline outline-1 -outline-offset-1 outline-gray-200 ring-offset-1 placeholder:opacity-50 focus:bg-gray-100 md:text-sm",
            props.error && ":base: pr-7"
          )}
          placeholder={props.placeholder}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Show when={props.error}>
          {(error) => (
            <div class=":base: absolute right-2 flex">
              <Tooltip content={error()}>
                <div class=":base: i-lucide:triangle-alert h-4 w-4 text-red-500" />
              </Tooltip>
            </div>
          )}
        </Show>
      </ArkCombobox.Control>
      <ArkCombobox.Positioner class=":base: z-50 w-[var(--reference-width)]">
        {/* A white card, as the editor's menus; it pads the sides, as the slash menu, so the scrollbar is inside its corners. */}
        <ArkCombobox.Content
          class={clsx(
            ":base: relative flex max-h-96 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white py-0 shadow-[0_0_12px_0px] shadow-gray-900/8",
            scrolls() ? ":base: pl-2 pr-1" : ":base: px-2"
          )}
        >
          <ScrollShadow color="white" scrollableContainerRef={listRef} />
          <ArkCombobox.List
            ref={(element) => {
              setListRef(element);
              measureScroll();
            }}
            class=":base: flex min-h-0 w-full flex-1 flex-col overflow-auto pb-2 pt-1 scrollbar-sm scrollbar-white"
          >
            <For each={options()}>
              {(option, index) => (
                <>
                  <Show when={option.group !== options()[index() - 1]?.group}>
                    <div class=":base: flex h-6 shrink-0 items-center justify-start px-2 text-xs font-medium text-gray-400">
                      {option.group}
                    </div>
                  </Show>
                  {/* As the slash menu's items: a small ghost button's text, an icon, and the label. */}
                  <ArkCombobox.Item
                    item={option}
                    class={clsx(
                      ":base: group/option flex shrink-0 cursor-pointer items-center justify-start rounded-lg py-0.5 pl-1 pr-0.5 text-sm font-medium text-gray-700 outline-none data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-gray-500/10 data-[highlighted]:to-transparent",
                      scrolls() ? ":base: w-[calc(100%-0.25rem)]" : ":base: w-full"
                    )}
                  >
                    <div class=":base: flex h-6 w-6 shrink-0 items-center justify-center">
                      <div
                        class={clsx(
                          ":base: h-5 w-5 text-gray-400 group-data-[highlighted]/option:text-gray-500",
                          option.icon
                        )}
                      />
                    </div>
                    <ArkCombobox.ItemText class=":base: min-w-0 flex-1 pl-1 text-left line-clamp-1">
                      {option.label}
                    </ArkCombobox.ItemText>
                  </ArkCombobox.Item>
                </>
              )}
            </For>
          </ArkCombobox.List>
        </ArkCombobox.Content>
      </ArkCombobox.Positioner>
    </ArkCombobox.Root>
  );
};

export { LinkInput };
