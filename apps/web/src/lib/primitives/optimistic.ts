import { type Accessor, createEffect, createSignal, on } from "solid-js";

interface OptimisticOverrides<Value> {
  get(key: string): Value | undefined;
  set(key: string, value: Value): void;
  clear(key: string): void;
  /** Each refetch of `source` drops the overrides whose change is no longer pending. */
  sync(source: Accessor<unknown>): void;
}

/** Values shown until refetched data takes over, by key, e.g. a toggled state being saved. */
const createOptimisticOverrides = <Value>(
  isPending: (key: string) => boolean
): OptimisticOverrides<Value> => {
  const [overrides, setOverrides] = createSignal<Record<string, Value>>({});

  return {
    get: (key) => overrides()[key],
    set: (key, value) => setOverrides((current) => ({ ...current, [key]: value })),
    clear: (key) => setOverrides(({ [key]: _, ...rest }) => rest),
    sync(source) {
      createEffect(
        on(
          source,
          () => {
            setOverrides((current) => {
              return Object.fromEntries(Object.entries(current).filter(([key]) => isPending(key)));
            });
          },
          { defer: true }
        )
      );
    }
  };
};

export { createOptimisticOverrides };
export type { OptimisticOverrides };
