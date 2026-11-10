import { debounce } from "@solid-primitives/scheduled";
import { BLOCK_CONTROL_MOVE_DELAY } from "#editor/ui/constants";

interface BlockControlMove<Args extends unknown[]> {
  (...args: Args): void;
  clear(): void;
}

/**
 * Moves a block control to another block after a short delay, against accidental moves. The delay
 * starts when the pointer reaches the block, so moving within it doesn't hold the control back.
 */
const createBlockControlMove = <Args extends [{ pos: number }, ...unknown[]]>(
  move: (...args: Args) => void
): BlockControlMove<Args> => {
  let pendingPos: number | null = null;

  const debounced = debounce((...args: Args) => {
    pendingPos = null;
    move(...args);
  }, BLOCK_CONTROL_MOVE_DELAY);
  const schedule = (...args: Args) => {
    if (args[0].pos === pendingPos) return;

    pendingPos = args[0].pos;
    debounced(...args);
  };

  return Object.assign(schedule, {
    clear() {
      pendingPos = null;
      debounced.clear();
    }
  });
};

export { createBlockControlMove };
