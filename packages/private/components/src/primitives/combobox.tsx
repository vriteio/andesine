import { Combobox as ArkCombobox, createListCollection } from "@ark-ui/solid/combobox";
import { createMediaQuery } from "@solid-primitives/media";
import clsx from "clsx";
import { createEffect, createMemo, createSignal, For, type JSX, Show } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { Fragment } from "./fragment";
import { createRef } from "../ref";

interface ComboboxOption {
  icon?: string | (() => JSX.Element);
  label: string;
  value: string;
}

interface ComboboxProps<O extends ComboboxOption> {
  class?: string;
  closeOnSelect?: boolean;
  disabled?: boolean;
  displaySelectedLabel?: boolean;
  inlineOptions?: boolean;
  label?: string;
  openOnFocus?: boolean;
  opened?: boolean;
  options: O[];
  optionsPlacement?: OptionsPlacement;
  placeholder?: string;
  portal?: boolean;
  preventAutoFocus?: boolean;
  value?: string;
  inputClass?: string;
  surfaceClass?: string;
  scrollableContainerClass?: string;
  setOpened?(opened: boolean): void;
  setValue?(value: string): void;
}

type OptionsPlacement = "bottom" | "top";

const Combobox = <O extends ComboboxOption>(props: ComboboxProps<O>): JSX.Element => {
  const [placement, setPlacement] = createSignal<OptionsPlacement>(
    props.optionsPlacement || "bottom"
  );
  const [inputValue, setInputValue] = createSignal<string | null>(null);
  const [internalOpened, setInternalOpened] = createSignal(false);
  const [mobileInputActive, setMobileInputActive] = createSignal(false);
  const [highlightedValue, setHighlightedValue] = createSignal<string | null>(null);
  const [inputRef, setInputRef] = createRef<HTMLInputElement | null>(null);
  const [mobileControlRef, setMobileControlRef] = createRef<HTMLButtonElement | null>(null);
  const [contentRef, setContentRef] = createRef<HTMLElement | null>(null);
  const [scrollableContainerRef, setScrollableContainerRef] = createRef<HTMLElement | null>(null);
  const md = createMediaQuery("(min-width: 768px)");

  const opened = () => props.opened ?? internalOpened();
  const selectedLabel = () => {
    return props.options.find((option) => option.value === props.value)?.label || "";
  };
  const optionsInline = () => props.inlineOptions || !md();
  const mobileTapControl = () => !md() && !mobileInputActive();
  const defaultOptionsPlacement = (): OptionsPlacement => props.optionsPlacement || "bottom";
  const resolvedOptionsPlacement = (): OptionsPlacement => {
    return optionsInline() ? defaultOptionsPlacement() : placement();
  };
  const setOpened = (nextOpened: boolean) => {
    if (opened() === nextOpened) return;

    if (typeof props.opened === "undefined") setInternalOpened(nextOpened);

    props.setOpened?.(nextOpened);
  };
  const opensToTop = () => resolvedOptionsPlacement() === "top";
  const filteredOptions = createMemo(() => {
    const query = inputValue()?.trim().toLocaleLowerCase();

    if (!query) return props.options;

    return props.options.filter((option) => {
      return option.label.toLocaleLowerCase().includes(query);
    });
  });
  const collection = createMemo(() => createListCollection({ items: filteredOptions() }));
  const mobileHighlightedValue = () => {
    const value = highlightedValue();

    if (!opened()) return null;

    return value !== null && collection().has(value) ? value : collection().firstValue;
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();

    if (event.key !== "Escape") return;

    event.preventDefault();
    setOpened(false);

    if (event.target instanceof HTMLInputElement) event.target.blur();
  };

  createEffect(() => {
    if (!opened()) {
      setInputValue(null);
      setMobileInputActive(false);
      setHighlightedValue(null);
    }
  });

  return (
    <ArkCombobox.Root
      class={clsx(
        ":base: flex w-full min-w-0 flex-col group",
        props.portal === false && "relative",
        props.class
      )}
      closeOnSelect={props.closeOnSelect ?? false}
      collection={collection()}
      disabled={props.disabled}
      inputBehavior="autohighlight"
      highlightedValue={md() ? undefined : mobileHighlightedValue()}
      onHighlightChange={(details) => setHighlightedValue(details.highlightedValue)}
      selectionBehavior={props.displaySelectedLabel ? "replace" : "clear"}
      inputValue={inputValue() ?? (props.displaySelectedLabel ? selectedLabel() : "")}
      open={opened()}
      openOnClick
      onInteractOutside={(event) => {
        if (event.detail.target === mobileControlRef()) event.preventDefault();
      }}
      positioning={{
        placement: `${defaultOptionsPlacement()}-start`,
        strategy: "absolute",
        offset: { mainAxis: 0 },
        flip: optionsInline()
          ? false
          : [defaultOptionsPlacement() === "top" ? "bottom-start" : "top-start"],
        sameWidth: !optionsInline(),
        slide: false,
        async updatePosition(data) {
          await data.updatePosition();

          if (optionsInline()) return;

          setPlacement(
            contentRef()?.getAttribute("data-placement")?.startsWith("top") ? "top" : "bottom"
          );
        }
      }}
      value={props.value ? [props.value] : []}
      scrollToIndexFn={({ getElement }) => {
        const item = getElement();
        const container = scrollableContainerRef();

        if (!item || !container) return;

        const itemRect = item.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const visibleTop = containerRect.top + container.clientTop;
        const height = container.clientHeight;
        const top =
          container.scrollTop + itemRect.top - visibleTop - height / 2 + itemRect.height / 2;

        container.scrollTo({ top, behavior: "auto" });
      }}
      onInputValueChange={(details) => {
        if (!props.displaySelectedLabel || details.reason === "input-change") {
          setInputValue(details.inputValue);
        }
      }}
      onOpenChange={(details) => {
        if (!details.open) setInputValue(null);

        setOpened(details.open);
      }}
      onValueChange={(details) => {
        const value = details.value[0];

        if (!value) return;

        props.setValue?.(value);
        setInputValue(null);
      }}
      onKeyDown={handleKeyDown}
      lazyMount
      unmountOnExit
    >
      <Show when={props.label}>
        <ArkCombobox.Label class=":base: mb-1 text-xs leading-[1] text-gray-400 group-focus-within:text-gray-500!">
          {props.label}
        </ArkCombobox.Label>
      </Show>
      <ArkCombobox.Control
        class={clsx(
          ":base: relative flex w-full min-w-0 items-center",
          optionsInline() && opensToTop() && ":base: order-2"
        )}
      >
        <ArkCombobox.Input
          ref={setInputRef}
          data-no-autofocus={props.preventAutoFocus || undefined}
          inert={mobileTapControl()}
          aria-label={props.label || props.placeholder || "Select"}
          class={clsx(
            ":base: h-7 max-h-7 w-full min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-1 px-2 pr-8 text-[16px] shadow-md shadow-gray-200 ring-offset-1 outline-none placeholder:opacity-50 focus:bg-gray-100! md:text-sm",
            opensToTop()
              ? ":base: data-[state=open]:rounded-t-none"
              : ":base: data-[state=open]:rounded-b-none",
            props.surfaceClass,
            props.inputClass
          )}
          placeholder={props.placeholder}
          onFocus={() => {
            if (props.openOnFocus !== false) setOpened(true);
          }}
        />
        <Show when={mobileTapControl()}>
          <button
            ref={setMobileControlRef}
            type="button"
            data-no-autofocus={props.preventAutoFocus || undefined}
            class="absolute inset-0 z-1 rounded-lg bg-transparent"
            disabled={props.disabled}
            aria-label={props.label || props.placeholder || "Select"}
            aria-expanded={opened()}
            onClick={() => {
              if (!opened()) {
                setOpened(true);
                return;
              }

              setMobileInputActive(true);
              inputRef()?.focus();
            }}
          />
        </Show>
        <span class=":base: i-lucide:chevrons-up-down pointer-events-none absolute right-2 shrink-0 text-gray-400" />
      </ArkCombobox.Control>
      <Dynamic component={!optionsInline() && props.portal !== false ? Portal : Fragment}>
        <ArkCombobox.Positioner
          class={clsx(
            ":base: z-50 select-none",
            optionsInline() && opensToTop() && ":base: order-1",
            optionsInline()
              ? ":base: !static !inset-auto !w-full !min-w-0 !max-w-full !transform-none"
              : ":base: w-[var(--reference-width)] min-w-[var(--reference-width)] max-w-[var(--reference-width)]"
          )}
        >
          <ArkCombobox.Content
            class={clsx(
              ":base: z-50 flex max-h-none w-full min-w-0 max-w-full flex-col overflow-hidden border-x border-gray-200 bg-white px-1 pointer-events-auto shadow-gray-200",
              !optionsInline() && ":base: max-h-[var(--available-height)] min-w-full",
              opensToTop()
                ? ":base: rounded-t-lg border-t shadow-[0_-4px_6px_-1px]"
                : ":base: rounded-b-lg border-b shadow-[0_4px_6px_-1px]",
              props.surfaceClass
            )}
            ref={setContentRef}
          >
            <div
              ref={setScrollableContainerRef}
              class={clsx(
                ":base: min-h-0 w-full min-w-0 flex-1 overflow-y-auto scrollbar-sm scrollbar-white",
                props.scrollableContainerClass
              )}
            >
              <ArkCombobox.List class=":base: flex w-full flex-col gap-0.5 py-1">
                <For each={filteredOptions()}>
                  {(option) => {
                    const selected = () => props.value === option.value;

                    return (
                      <ArkCombobox.Item
                        item={option}
                        persistFocus
                        class={clsx(
                          ":base: relative flex w-full cursor-pointer items-center justify-start gap-1 rounded-md px-1 py-0.5 outline-none z-1",
                          selected()
                            ? ":base: group/combobox-item"
                            : ":base: media-mouse:data-[highlighted]:bg-gray-100"
                        )}
                      >
                        <Show when={selected()}>
                          <div class=":base: absolute inset-0 -z-1 rounded-md bg-gradient-to-tr opacity-10 media-mouse:group-data-[highlighted]/combobox-item:opacity-100 pointer-events-none" />
                        </Show>
                        <Show when={option.icon} keyed>
                          {(icon) => (
                            <div
                              class={clsx(
                                ":base: h-4.5 w-4.5 shrink-0",
                                typeof icon === "string" && icon,
                                selected()
                                  ? ":base: bg-gradient-to-tr media-mouse:group-data-[highlighted]/combobox-item:(text-white bg-none)"
                                  : ":base: text-gray-500"
                              )}
                            >
                              {typeof icon === "function" && <Dynamic component={icon} />}
                            </div>
                          )}
                        </Show>
                        <ArkCombobox.ItemText
                          title={option.label}
                          class={clsx(
                            ":base: flex-1 px-1 text-start text-sm line-clamp-1",
                            selected()
                              ? ":base: bg-gradient-to-tr bg-clip-text text-transparent media-mouse:group-data-[highlighted]/combobox-item:text-white"
                              : ":base: text-gray-700"
                          )}
                        >
                          {option.label}
                        </ArkCombobox.ItemText>
                      </ArkCombobox.Item>
                    );
                  }}
                </For>
                <ArkCombobox.Empty class=":base: px-2 py-1 text-sm text-gray-400">
                  No options
                </ArkCombobox.Empty>
              </ArkCombobox.List>
            </div>
          </ArkCombobox.Content>
        </ArkCombobox.Positioner>
      </Dynamic>
    </ArkCombobox.Root>
  );
};

export { Combobox };
export type { ComboboxOption };
