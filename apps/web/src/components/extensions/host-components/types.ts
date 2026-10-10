import {
  type ExtensionComponentName,
  type ExtensionComponentProps
} from "@andesine/contracts/extensions";
import { type ExtensionTreeNode } from "#web/lib/extensions";
import { type Component, type JSX } from "solid-js";

interface HostComponentProps<N extends ExtensionComponentName> {
  /** The component's own node. */
  id: number;
  props: ExtensionComponentProps<N>;
  /** Calls the extension callback of an event with plain values. */
  emit(event: string, ...args: unknown[]): void;
  children?: JSX.Element;
  /** Child nodes, for components that wrap or select their children (lists, tabs, steps). */
  childNodes(): ExtensionTreeNode[];
  renderNode(id: number): JSX.Element;
  /** Any node of the view tree, for components built from nested nodes (menus). */
  getNode(id: number): ExtensionTreeNode | undefined;
  /** Calls the extension callback of another node's event, e.g. a menu item's `onSelect`. */
  emitNode(id: number, event: string, ...args: unknown[]): void;
  /** Whether the member interacted with the extension recently, e.g. before a dialog opens. */
  hasRecentInteraction(): boolean;
  /** The extension's declared request URLs, which links and images must match. */
  sources: string[];
  extension: string;
}

type HostComponents = { [N in ExtensionComponentName]: Component<HostComponentProps<N>> };

const gapClasses = { none: "gap-0", small: "gap-1", medium: "gap-2", large: "gap-4" };
const toneClasses = {
  default: "",
  muted: "text-gray-500",
  danger: "text-red-500",
  success: "text-green-500"
};

export { gapClasses, toneClasses };
export type { HostComponentProps, HostComponents };
