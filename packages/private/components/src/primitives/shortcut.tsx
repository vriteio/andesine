import clsx from "clsx";
import { type Component, createMemo, createSignal, For, Switch, Match, onMount } from "solid-js";

interface ShortcutProps {
  /** Keys joined with `+`, e.g. `$mod+k`. `$mod` is Command on Apple devices and Ctrl elsewhere. */
  shortcut: string;
  class?: string;
}

const Shortcut: Component<ShortcutProps> = (props) => {
  // Detected after mount, so the server and hydration render the same keys.
  const [isApple, setIsApple] = createSignal(false);
  const shortcutPieces = createMemo(() => {
    return props.shortcut.split("+").map((piece) => {
      const key = piece.toLowerCase().trim();

      return key === "$mod" && !isApple() ? "ctrl" : key;
    });
  });

  onMount(() => setIsApple(/Mac|iPhone|iPad/.test(navigator.userAgent)));

  return (
    <kbd class={clsx(":base: font-mono flex items-center justify-center", props.class)}>
      <For each={shortcutPieces()}>
        {(piece) => (
          <Switch>
            <Match when={piece === "$mod"}>
              <span class="inline-block i-lucide:command" />
            </Match>
            <Match when={piece === "ctrl" || (piece === "alt" && !isApple())}>
              <span class="pr-0.5 leading-[1] font-light">{piece === "ctrl" ? "Ctrl" : "Alt"}</span>
            </Match>
            <Match when={piece === "alt"}>
              <span class="inline-block i-lucide:option" />
            </Match>
            <Match when={piece === "shift"}>
              <span class="inline-block i-lucide:arrow-big-up" />
            </Match>
            <Match when={piece === "enter"}>
              <span class="inline-block i-lucide:corner-down-left" />
            </Match>
            <Match when={piece === "backspace"}>
              <span class="inline-block i-lucide:delete" />
            </Match>
            <Match when={/f\d\d?/i.test(piece)}>
              <span class="min-w-3 leading-[1] text-[90%] font-light text-center">
                {piece.toUpperCase()}
              </span>
            </Match>
            <Match when={true}>
              <span class="w-3 leading-[1] font-light text-center">{piece.toUpperCase()}</span>
            </Match>
          </Switch>
        )}
      </For>
    </kbd>
  );
};

export { Shortcut };
