import { createSignal } from "solid-js";

// Elements that show their XML in place of their view; in memory, for this session only.
const [sourceElements, setSourceElements] = createSignal<ReadonlySet<string>>(new Set());

const isSourceShown = (id: string | null | undefined): boolean => {
  return Boolean(id) && sourceElements().has(id!);
};
/** Switches an element between its view and its XML, e.g. from its menu. */
const toggleSourceShown = (id: string): void => {
  setSourceElements((current) => {
    const next = new Set(current);

    if (!next.delete(id)) next.add(id);

    return next;
  });
};

export { sourceElements, isSourceShown, toggleSourceShown };
