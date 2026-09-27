import { type Accessor, createSignal } from "solid-js";

interface ListNavigationOptions {
  count: Accessor<number>;
  /** Called on Enter with the active index. */
  onSelect(index: number): void;
}

interface ListNavigation {
  active: Accessor<number>;
  setActive(index: number): void;
  /** Handles arrow, Home, End, and Enter keys, e.g. on a combobox input. */
  onKeyDown(event: KeyboardEvent): void;
}

/** Keyboard navigation for a list whose focus stays on another element. */
const createListNavigation = (options: ListNavigationOptions): ListNavigation => {
  const [active, setActive] = createSignal(0);
  const moves: Record<string, (index: number, count: number) => number> = {
    ArrowDown: (index, count) => (index + 1) % count,
    ArrowUp: (index, count) => (index - 1 + count) % count,
    Home: () => 0,
    End: (_, count) => count - 1
  };

  return {
    active,
    setActive,
    onKeyDown: (event) => {
      const count = options.count();
      const move = moves[event.key];

      if (!count || event.isComposing) return;

      if (event.key === "Enter") {
        event.preventDefault();
        options.onSelect(Math.min(active(), count - 1));
      }

      if (!move) return;

      event.preventDefault();
      setActive(move(Math.min(active(), count - 1), count));
    }
  };
};

export { createListNavigation };
export type { ListNavigationOptions, ListNavigation };
