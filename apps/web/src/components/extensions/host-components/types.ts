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
  /** Whether the extension handles an event, e.g. to show a row as clickable. */
  hasEvent(event: string): boolean;
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

// Host defaults are `:base:`, a low layer, so that a view's classes always win, e.g. `gap-1.5`.
const gapClasses = {
  none: ":base: gap-0",
  small: ":base: gap-1",
  medium: ":base: gap-2",
  large: ":base: gap-4"
};
const toneClasses = {
  default: "",
  muted: ":base: text-gray-500",
  danger: ":base: text-red-500",
  success: ":base: text-green-500"
};

// Icon colors of statuses, e.g. on `Item` rows and badges; the text stays neutral.
const iconToneClasses = {
  muted: "text-gray-400",
  primary: "bg-gradient-to-tr",
  success: "text-green-500",
  warning: "text-amber-500",
  danger: "text-red-500"
};

export { gapClasses, iconToneClasses, toneClasses };
export type { HostComponentProps, HostComponents };
