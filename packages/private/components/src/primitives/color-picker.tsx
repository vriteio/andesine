import { ColorPicker as ArkColorPicker, type Color, parseColor } from "@ark-ui/solid/color-picker";
import clsx from "clsx";
import { type Component, createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { Button } from "./button";
import { Card } from "./card";
import { Fragment } from "./fragment";
import { Input } from "./input";

interface ColorPickerProps {
  /** A hex color, e.g. `#ff3617`. */
  value?: string;
  /** Hex colors offered as swatches, e.g. brand colors. */
  presets?: string[];
  disabled?: boolean;
  portal?: boolean;
  positioningStrategy?: "absolute" | "fixed";
  class?: string;
  setValue?(value: string): void;
}

const HEX_PATTERN = /^#[\da-f]{6}$/i;
const HEX_DRAFT_PATTERN = /^#?([\da-f]{6})$/i;
const FALLBACK_COLOR = "#000000";
const thumbClass =
  "h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md shadow-black/30 outline-none focus-visible:ring-2 focus-visible:ring-gray-400";

const toHex = (value?: string): string => {
  return value && HEX_PATTERN.test(value) ? value.toLowerCase() : FALLBACK_COLOR;
};
const formatHex = (color: Color): string => color.toString("hex").toLowerCase();
/** A swatch button with a popover: saturation and brightness area, hue slider, hex input, presets. */
const ColorPicker: Component<ColorPickerProps> = (props) => {
  // Hex has no hue for grays, so the picker keeps its own color while the value matches it.
  const [color, setColor] = createSignal(parseColor(toHex(props.value)));
  const [hexDraft, setHexDraft] = createSignal(toHex(props.value));
  const presets = createMemo(() =>
    (props.presets ?? []).filter((preset) => HEX_PATTERN.test(preset))
  );
  const change = (next: Color) => {
    const hex = formatHex(next);

    setColor(next);

    if (hex !== toHex(props.value)) props.setValue?.(hex);
  };
  const commitHexDraft = () => {
    const digits = HEX_DRAFT_PATTERN.exec(hexDraft().trim())?.[1];

    const hex = digits && `#${digits.toLowerCase()}`;

    if (hex && hex !== formatHex(color())) change(parseColor(hex));
    else setHexDraft(formatHex(color()));
  };

  createEffect(
    on(
      () => toHex(props.value),
      (hex) => {
        if (hex !== formatHex(color())) setColor(parseColor(hex));
      },
      { defer: true }
    )
  );
  createEffect(on(color, (current) => setHexDraft(formatHex(current))));

  return (
    <ArkColorPicker.Root
      class={clsx("w-full", props.portal === false && "relative", props.class)}
      value={color()}
      format="hsba"
      disabled={props.disabled}
      positioning={{
        placement: "bottom-start",
        offset: { mainAxis: 4 },
        strategy: props.positioningStrategy
      }}
      onValueChange={(details) => change(details.value)}
      lazyMount
      unmountOnExit
    >
      <ArkColorPicker.Control>
        <ArkColorPicker.Trigger
          asChild={(triggerProps) => (
            <Button
              {...triggerProps()}
              class=":base-2: flex w-full min-w-0 items-center gap-2 py-1 px-1.5 font-mono"
              variant="secondary"
              disabled={props.disabled}
            >
              {/* 4px from the button's edges, so its corners follow the button's 8px radius. */}
              <ArkColorPicker.ValueSwatch class="h-4 w-4 shrink-0 rounded border border-black/10" />
              <span class="min-w-0 flex-1 truncate text-start text-sm">
                <span class="text-gray-400">#</span>
                {toHex(props.value).slice(1)}
              </span>
              <span class="i-lucide:chevrons-up-down ml-auto shrink-0 text-gray-400" />
            </Button>
          )}
        />
      </ArkColorPicker.Control>
      <Dynamic component={props.portal === false ? Fragment : Portal}>
        <ArkColorPicker.Positioner class="z-50">
          <ArkColorPicker.Content
            asChild={(contentProps) => (
              <Card
                {...contentProps()}
                shade
                class={clsx(
                  ":base-2: z-50 flex w-56 flex-col gap-2 rounded-[0.625rem] bg-white p-2 pointer-events-auto shadow-gray-900/8 transition duration-200",
                  "data-[state=open]:visible data-[state=open]:opacity-100",
                  "data-[state=closed]:invisible data-[state=closed]:opacity-0 data-[state=closed]:!shadow-none"
                )}
                style={{ "transform-origin": "var(--transform-origin)" }}
              >
                <ArkColorPicker.Area class="relative h-32 w-full">
                  <ArkColorPicker.AreaBackground class="h-full w-full rounded-md" />
                  <ArkColorPicker.AreaThumb class={thumbClass} />
                </ArkColorPicker.Area>
                {/* The track overhangs the thumb's range by its radius, so the thumb stays on it. */}
                <ArkColorPicker.ChannelSlider channel="hue" class="relative mx-2">
                  <ArkColorPicker.ChannelSliderTrack class="-mx-2 h-3 rounded-full" />
                  <ArkColorPicker.ChannelSliderThumb class={thumbClass} />
                </ArkColorPicker.ChannelSlider>
                <Input
                  aria-label="Hex color"
                  class=":base-2: w-full min-w-0 flex-none rounded-md bg-gray-50 font-mono"
                  value={hexDraft()}
                  setValue={setHexDraft}
                  onConfirm={commitHexDraft}
                  onKeyDown={(event) => event.stopPropagation()}
                />
                <Show when={presets().length}>
                  <ArkColorPicker.SwatchGroup class="flex flex-wrap gap-1.5">
                    <For each={presets()}>
                      {(preset) => (
                        <ArkColorPicker.SwatchTrigger
                          value={preset}
                          title={preset}
                          class="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        >
                          <ArkColorPicker.Swatch
                            value={preset}
                            class="h-6 w-6 rounded-md border border-black/10"
                          />
                        </ArkColorPicker.SwatchTrigger>
                      )}
                    </For>
                  </ArkColorPicker.SwatchGroup>
                </Show>
              </Card>
            )}
          />
        </ArkColorPicker.Positioner>
      </Dynamic>
    </ArkColorPicker.Root>
  );
};

export { ColorPicker };
