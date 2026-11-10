import clsx from "clsx";
import { type Component, For, Match, Switch } from "solid-js";

interface ShortcutProps {
  /** Keys joined with `+`, e.g. `$mod+K`. `$mod` is Command on Apple devices and Ctrl elsewhere. */
  shortcut: string;
  /** Shows `$mod` as Ctrl. */
  ctrl?: boolean;
  class?: string;
}

/** A keyboard shortcut with key icons, after the Andesine app's shortcut. */
const Shortcut: Component<ShortcutProps> = (props) => {
  const pieces = (): string[] => {
    return props.shortcut.split("+").map((piece) => {
      const key = piece.toLowerCase().trim();

      return key === "$mod" && props.ctrl ? "ctrl" : key;
    });
  };

  return (
    <kbd class={clsx(":base: flex items-center justify-center font-mono", props.class)}>
      <For each={pieces()}>
        {(piece) => (
          <Switch>
            <Match when={piece === "$mod"}>
              <span class="i-lucide:command inline-block" />
            </Match>
            <Match when={piece === "ctrl"}>
              <span class="pr-0.5 font-light leading-[1]">Ctrl</span>
            </Match>
            <Match when={piece === "alt"}>
              <span class="i-lucide:option inline-block" />
            </Match>
            <Match when={piece === "shift"}>
              <span class="i-lucide:arrow-big-up inline-block" />
            </Match>
            <Match when={piece === "enter"}>
              <span class="i-lucide:corner-down-left inline-block" />
            </Match>
            <Match when={piece === "backspace"}>
              <span class="i-lucide:delete inline-block" />
            </Match>
            <Match when={/^f\d\d?$/.test(piece)}>
              <span class="min-w-3 text-center text-[90%] font-light leading-[1]">
                {piece.toUpperCase()}
              </span>
            </Match>
            <Match when={true}>
              <span class="w-3 text-center font-light leading-[1]">{piece.toUpperCase()}</span>
            </Match>
          </Switch>
        )}
      </For>
    </kbd>
  );
};

export { Shortcut };
