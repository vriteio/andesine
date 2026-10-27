import { createContext, useContext, type Accessor } from "solid-js";
import type { BlockControlRange } from "#editor/ui/block-control-targeting";

interface BlockMenuContextValue {
  handleCopy(): boolean;
  handleDelete(): boolean;
  openMenu(reference?: HTMLElement): void;
  /** Whether the block menu is open, e.g. to hide tooltips under it. */
  menuOpened: Accessor<boolean>;
  setTextMenuSelectionRange(range: BlockControlRange | null): void;
}

const BlockMenuContext = createContext<BlockMenuContextValue>({
  handleCopy: () => false,
  handleDelete: () => false,
  openMenu: () => {},
  menuOpened: () => false,
  setTextMenuSelectionRange: () => {}
});
const BlockMenuContextProvider = BlockMenuContext.Provider;

const useBlockMenuContext = () => {
  return useContext(BlockMenuContext)!;
};

export { BlockMenuContextProvider, useBlockMenuContext };
