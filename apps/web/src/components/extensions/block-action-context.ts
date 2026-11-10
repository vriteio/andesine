import { type BlockActionOrigin } from "@andesine/editor";
import { createContext, useContext } from "solid-js";

/** What a block action view's root `Dialog` or `Menu` acts on; other views have none. */
interface BlockActionPresentation {
  /** Where the block menu was; null on narrow screens. */
  origin: BlockActionOrigin | null;
  /** The selected blocks' bounds, for a menu without an origin; null once they are gone. */
  getBlocksRect(): DOMRect | null;
  /** After a menu choice: the action runs on without UI until it closes, with a time limit. */
  continueWithoutUI(): void;
  close(): void;
}

const BlockActionContext = createContext<BlockActionPresentation>();
const useBlockAction = () => useContext(BlockActionContext);

export { BlockActionContext, useBlockAction };
export type { BlockActionPresentation };
