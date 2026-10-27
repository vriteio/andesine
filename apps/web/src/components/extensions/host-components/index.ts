import { BlockArea, BlockPresentation, ContentSlot } from "./content-slot";
import { controlComponents } from "./controls";
import { dataComponents } from "./data";
import { ExtensionIconPicker } from "./icon-picker";
import { ImageInput } from "./image-input";
import { ExtensionLinkInput } from "./link-input";
import { layoutComponents } from "./layout";
import { overlayComponents } from "./overlays";
import { textComponents } from "./text";
import { ExtensionItem, ExtensionItemDetails } from "./item";
import { ExtensionItemGroup, ExtensionNavigation } from "./navigation";
import { ExtensionTree } from "./tree";
import { type HostComponents } from "./types";

/** Andesine components that extension views render; props are validated by the view tree. */
const hostComponents: HostComponents = {
  ...layoutComponents,
  ...textComponents,
  ...controlComponents,
  ...dataComponents,
  ...overlayComponents,
  ImageInput,
  IconPicker: ExtensionIconPicker,
  LinkInput: ExtensionLinkInput,
  Tree: ExtensionTree,
  Navigation: ExtensionNavigation,
  Item: ExtensionItem,
  ItemDetails: ExtensionItemDetails,
  ItemGroup: ExtensionItemGroup,
  ContentSlot,
  BlockPresentation,
  BlockArea
};

export { hostComponents };
export { ContentSlotContext } from "./content-slot";
export type { ContentSlotHandle } from "./content-slot";
export type { HostComponentProps } from "./types";
