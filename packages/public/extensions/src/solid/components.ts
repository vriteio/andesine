import type { JSX } from "solid-js";
import { createElement, spread } from "./renderer";

interface ParentProps {
  children?: JSX.Element;
}
interface StyleProps {
  /** Utility classes of the Andesine UnoCSS preset; the extension build generates their CSS. */
  class?: string;
}
interface ButtonBaseProps {
  /** Defaults to `secondary` for buttons and `ghost` for icon buttons. */
  variant?: "primary" | "secondary" | "ghost" | "link" | "danger";
  size?: "small" | "medium";
  disabled?: boolean;
  onClick?(): void;
}
interface FieldProps {
  value?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  onInput?(value: string): void;
}
interface Option {
  value: string;
  label: string;
}
interface ChoiceProps {
  value?: string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  onChange?(value: string): void;
}
interface ToggleProps {
  checked?: boolean;
  label?: string;
  disabled?: boolean;
  onChange?(checked: boolean): void;
}
interface StackProps extends ParentProps, StyleProps {
  direction?: "row" | "column";
  gap?: Gap;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
}
interface GridProps extends ParentProps, StyleProps {
  columns?: number;
  gap?: Gap;
}
interface BoxProps extends ParentProps, StyleProps {
  padding?: Gap;
  background?: "none" | "soft" | "contrast";
  border?: boolean;
}
interface ScrollAreaProps extends ParentProps {
  maxHeight?: Size;
}
interface TextProps extends ParentProps, StyleProps {
  size?: "xs" | "sm" | "base" | "lg";
  weight?: "normal" | "medium" | "semibold";
  tone?: Tone;
}
interface HeadingProps extends ParentProps, StyleProps {
  level?: 1 | 2 | 3;
}
interface LinkProps extends ParentProps {
  /** An `https:` URL within the extension's declared request URLs. */
  href: string;
}
interface BadgeProps extends ParentProps {
  color?: "base" | "primary" | "danger" | "success";
}
interface IconProps {
  /** An icon class, e.g. `i-lucide:rocket`, or `i-acme:logo?bg` for a colored icon. */
  name: string;
  size?: Size;
  tone?: Tone;
}
interface ButtonProps extends ButtonBaseProps, ParentProps {
  loading?: boolean;
}
interface IconButtonProps extends ButtonBaseProps {
  icon: string;
  label: string;
}
interface InputProps extends FieldProps {
  type?: "text" | "url" | "number";
  onEnter?(): void;
}
interface TextareaProps extends FieldProps {
  rows?: number;
}
interface ToggleGroupProps {
  value?: string;
  options: Option[];
  disabled?: boolean;
  onChange?(value: string): void;
}
interface ColorInputProps {
  /** A hex color, e.g. `#ff3617`. */
  value?: string;
  disabled?: boolean;
  onInput?(value: string): void;
}
interface TooltipProps extends ParentProps {
  content: string;
}
/**
 * A modal, shown while rendered. Outside block actions, render it right after an interaction,
 * e.g. from `onClick`; otherwise it isn't shown. In a block action, closing it closes the action.
 */
interface DialogProps extends ParentProps {
  title: string;
  description?: string;
  size?: Size;
  /** Whether Escape, an outside click, or the close button call `onClose` (default true). */
  dismissible?: boolean;
  onClose?(): void;
}
/**
 * A dropdown menu of `MenuItem`, `MenuGroup`, `MenuSeparator`, and `MenuContent` children,
 * opened by its `MenuTrigger`, or with `contextMenu` by a right click on it. At a block action
 * view's root it needs no trigger: it opens where the block menu was, and closing it closes the action.
 */
interface MenuProps extends ParentProps {
  /** The title of the bottom sheet on small screens. */
  title?: string;
  /** Controls the open state; without it, the menu opens and closes on its own. */
  opened?: boolean;
  contextMenu?: boolean;
  placement?:
    "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start";
  size?: "small" | "medium";
  onOpenChange?(opened: boolean): void;
}
/** Nested items make a submenu, which replaces `onSelect`. */
interface MenuItemProps extends ParentProps {
  label: string;
  icon?: string;
  /** Shown next to the label; handle the keys yourself. */
  shortcut?: string;
  color?: "base" | "danger";
  disabled?: boolean;
  /** A spinner replaces the icon, and the item is disabled. */
  loading?: boolean;
  selected?: boolean;
  closeOnSelect?: boolean;
  onSelect?(): void;
}
interface MenuGroupProps extends ParentProps {
  label?: string;
}
interface SettingProps extends ParentProps {
  label: string;
  description?: string;
}
interface ListProps extends ParentProps {
  addLabel?: string;
  emptyLabel?: string;
  disabled?: boolean;
  onAdd?(): void;
  onRemove?(index: number): void;
  onMove?(from: number, to: number): void;
}
interface CardProps extends ParentProps {
  color?: "base" | "contrast" | "soft";
}
interface TreeItem {
  id: string;
  label: string;
  icon?: string;
  /** The parent item ID; top level when unset. */
  parent?: string;
}
interface TreeProps {
  items: TreeItem[];
  selected?: string;
  emptyLabel?: string;
  onSelect?(id: string): void;
}
interface TabsProps extends ParentProps {
  value?: string;
  onChange?(value: string): void;
}
interface TabProps extends ParentProps {
  value: string;
  label: string;
}
interface DisclosureProps extends ParentProps {
  label: string;
  open?: boolean;
}
interface CalloutProps extends ParentProps {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
}
interface StepProps extends ParentProps {
  title: string;
}
interface FigureProps {
  /** An `https:` image URL within the extension's declared request URLs. */
  src: string;
  alt: string;
  caption?: string;
}
interface CodeBlockProps {
  code: string;
  language?: string;
}
interface TimeAgoProps {
  /** An ISO date-time. */
  date: string;
}
interface SpinnerProps {
  size?: Size;
}
interface SkeletonProps {
  height?: Size;
}

type Gap = "none" | "small" | "medium" | "large";
type Size = "small" | "medium" | "large";
type Tone = "default" | "muted" | "danger" | "success";
type EmptyProps = Record<string, never>;

// Host components are serialized nodes; the host renders the matching Andesine component.
const hostComponent = <P extends object>(name: string) => {
  return (props: P): JSX.Element => {
    const node = createElement(name);

    spread(node, props);

    return node as unknown as JSX.Element;
  };
};
const Stack = hostComponent<StackProps>("Stack");
const Grid = hostComponent<GridProps>("Grid");
const Box = hostComponent<BoxProps>("Box");
const Divider = hostComponent<EmptyProps>("Divider");
const ScrollArea = hostComponent<ScrollAreaProps>("ScrollArea");
const Text = hostComponent<TextProps>("Text");
const Heading = hostComponent<HeadingProps>("Heading");
const Code = hostComponent<ParentProps>("Code");
const Link = hostComponent<LinkProps>("Link");
const Badge = hostComponent<BadgeProps>("Badge");
const Icon = hostComponent<IconProps>("Icon");
const Button = hostComponent<ButtonProps>("Button");
const IconButton = hostComponent<IconButtonProps>("IconButton");
const Input = hostComponent<InputProps>("Input");
const Textarea = hostComponent<TextareaProps>("Textarea");
const Select = hostComponent<ChoiceProps>("Select");
const Combobox = hostComponent<ChoiceProps>("Combobox");
const Checkbox = hostComponent<ToggleProps>("Checkbox");
const Toggle = hostComponent<ToggleProps>("Toggle");
const ToggleGroup = hostComponent<ToggleGroupProps>("ToggleGroup");
const ColorInput = hostComponent<ColorInputProps>("ColorInput");
const Tooltip = hostComponent<TooltipProps>("Tooltip");
const Dialog = hostComponent<DialogProps>("Dialog");
const Menu = hostComponent<MenuProps>("Menu");
const MenuTrigger = hostComponent<ParentProps>("MenuTrigger");
const MenuItem = hostComponent<MenuItemProps>("MenuItem");
const MenuGroup = hostComponent<MenuGroupProps>("MenuGroup");
const MenuSeparator = hostComponent<EmptyProps>("MenuSeparator");
/** A custom menu item: any content, e.g. a result or a form. */
const MenuContent = hostComponent<ParentProps>("MenuContent");
const Setting = hostComponent<SettingProps>("Setting");
const List = hostComponent<ListProps>("List");
const Card = hostComponent<CardProps>("Card");
const Tree = hostComponent<TreeProps>("Tree");
const Tabs = hostComponent<TabsProps>("Tabs");
const Tab = hostComponent<TabProps>("Tab");
const Disclosure = hostComponent<DisclosureProps>("Disclosure");
const Callout = hostComponent<CalloutProps>("Callout");
const Steps = hostComponent<ParentProps>("Steps");
const Step = hostComponent<StepProps>("Step");
const Figure = hostComponent<FigureProps>("Figure");
const CodeBlock = hostComponent<CodeBlockProps>("CodeBlock");
const TimeAgo = hostComponent<TimeAgoProps>("TimeAgo");
const Spinner = hostComponent<SpinnerProps>("Spinner");
const Skeleton = hostComponent<SkeletonProps>("Skeleton");
/** Where an element view shows the element's editable content (element views only). */
const ContentSlot = hostComponent<EmptyProps>("ContentSlot");

export {
  Stack,
  Grid,
  Box,
  Divider,
  ScrollArea,
  Text,
  Heading,
  Code,
  Link,
  Badge,
  Icon,
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Combobox,
  Checkbox,
  Toggle,
  ToggleGroup,
  ColorInput,
  Tooltip,
  Dialog,
  Menu,
  MenuTrigger,
  MenuItem,
  MenuGroup,
  MenuSeparator,
  MenuContent,
  Setting,
  List,
  Card,
  Tree,
  Tabs,
  Tab,
  Disclosure,
  Callout,
  Steps,
  Step,
  Figure,
  CodeBlock,
  TimeAgo,
  Spinner,
  Skeleton,
  ContentSlot
};
export type {
  StackProps,
  GridProps,
  BoxProps,
  ScrollAreaProps,
  TextProps,
  HeadingProps,
  ParentProps,
  LinkProps,
  BadgeProps,
  IconProps,
  ButtonProps,
  IconButtonProps,
  InputProps,
  TextareaProps,
  ChoiceProps,
  ToggleProps,
  ToggleGroupProps,
  ColorInputProps,
  TooltipProps,
  DialogProps,
  MenuProps,
  MenuItemProps,
  MenuGroupProps,
  SettingProps,
  ListProps,
  CardProps,
  TreeItem,
  TreeProps,
  TabsProps,
  TabProps,
  DisclosureProps,
  CalloutProps,
  StepProps,
  FigureProps,
  CodeBlockProps,
  TimeAgoProps,
  SpinnerProps,
  SkeletonProps,
  EmptyProps,
  StyleProps,
  Option
};
