import { ContentSlot } from "./content-slot";
import { controlComponents } from "./controls";
import { dataComponents } from "./data";
import { layoutComponents } from "./layout";
import { overlayComponents } from "./overlays";
import { textComponents } from "./text";
import { ExtensionTree } from "./tree";
import { type HostComponents } from "./types";

/** Andesine components that extension views render; props are validated by the view tree. */
const hostComponents: HostComponents = {
  ...layoutComponents,
  ...textComponents,
  ...controlComponents,
  ...dataComponents,
  ...overlayComponents,
  Tree: ExtensionTree,
  ContentSlot
};

export { hostComponents };
export { ContentSlotContext } from "./content-slot";
export type { ContentSlotHandle } from "./content-slot";
export type { HostComponentProps } from "./types";
