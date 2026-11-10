import type { JSX } from "solid-js";
import { createElement, spread } from "./renderer";

interface ParentProps {
  children?: JSX.Element;
}
interface StyleProps {
  /** Utility classes of the Andesine UnoCSS preset; the extension build generates their CSS. */
  class?: string;
}
interface ButtonBaseProps extends StyleProps {
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
  /** Monospace, smaller text, e.g. for paths or glob patterns. */
  code?: boolean;
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
interface SectionProps extends ParentProps {
  title: string;
}
interface SaveBarProps {
  /** Enables the actions: there are unsaved changes. */
  dirty: boolean;
  saving?: boolean;
  /** A tooltip on the save button, e.g. what a save starts. */
  message?: string;
  /** Default: "Save changes". */
  saveLabel?: string;
  onSave?(): void;
  onDiscard?(): void;
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
/** A white outlined status badge, as the app's webhook deliveries; `tone` colors its icon. */
interface BadgeProps extends ParentProps {
  /** An icon class, e.g. `i-lucide:circle-check`. */
  icon?: string;
  /** Defaults to `muted`; `primary` has the brand gradient. */
  tone?: StatusTone;
}
interface IconProps extends StyleProps {
  /** An icon class, e.g. `i-lucide:rocket`, or `i-acme:logo?bg` for a colored icon. */
  name: string;
  size?: Size;
  tone?: Tone;
}
interface ButtonProps extends ButtonBaseProps, ParentProps {
  loading?: boolean;
  /** After the label, e.g. `i-lucide:plus` on a setting's main action. */
  icon?: string;
}
interface IconButtonProps extends ButtonBaseProps {
  icon: string;
  label: string;
}
interface InputProps extends FieldProps {
  type?: "text" | "url" | "number";
  /** Fixed text inside the field after the value, e.g. `.example.com` after a subdomain. */
  suffix?: string;
  onEnter?(): void;
}
interface TextareaProps extends FieldProps {
  rows?: number;
}
interface MultiSelectProps {
  values?: string[];
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  onChange?(values: string[]): void;
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
  /** Up to 12 hex colors offered as swatches, e.g. brand colors. */
  presets?: string[];
  disabled?: boolean;
  onInput?(value: string): void;
}
/** A file chosen in `ImageInput`; the host checked its format and size. */
interface ImageFile {
  name: string;
  type: string;
  size: number;
  /** The file's content, base64-encoded. */
  data: string;
}
interface ImageInputProps {
  /** The current image for the preview: an HTTPS URL of a declared request, or an image data URL. */
  value?: string;
  /** Default: PNG, JPEG, WebP, and SVG. */
  accept?: Array<"png" | "jpeg" | "webp" | "gif" | "svg" | "ico">;
  /** In bytes, up to 2 MB (the default). */
  maxSize?: number;
  disabled?: boolean;
  onChange?(file: ImageFile): void;
  onRemove?(): void;
}
interface IconPickerProps {
  /** An icon class, e.g. `i-lucide:link`, or empty for none. */
  value?: string;
  /** The sets listed together, in this order; Lucide by default. */
  sets?: Array<"lucide" | "tabler" | "simple-icons">;
  placeholder?: string;
  disabled?: boolean;
  /** A button that removes the icon, e.g. for an optional one; `onChange` then gets `""`. */
  clearable?: boolean;
  /** A square button with only the icon, e.g. before a field in a row. */
  compact?: boolean;
  onChange?(value: string): void;
}
interface LinkInputProps {
  /** An `entry:<entryID>` link, a URL, or a path when `paths` is set. */
  value?: string;
  placeholder?: string;
  /** Also takes paths, e.g. `/blog` on a site. */
  paths?: boolean;
  /** Lists only the entries in this collection, at any depth, e.g. a site's. */
  collectionID?: string;
  disabled?: boolean;
  /** A chosen entry's `entry:<entryID>` link, a valid typed link, or `""` when cleared. */
  onChange?(value: string): void;
}
interface ContentSlotProps extends ParentProps {
  /** Shown while the element's content is empty, e.g. "Type / to insert a card". */
  placeholder?: string;
  /**
   * Utility classes on the slot. With `contents` here and on `contentClass`, the content's blocks
   * become items of the slot's parent, e.g. cards in the view's grid next to an "Add card" button.
   */
  class?: string;
  /** Utility classes on the element's content itself, e.g. `grid gap-4` for a grid of cards. */
  contentClass?: string;
  /**
   * The content's blocks have the editor's drag handle and block menu, e.g. a tab's paragraphs.
   * Without it, inside a view, they're only for the top-level block.
   */
  controls?: boolean;
}
/** Rendered by `<Block>`; presents the slot's child blocks with these node IDs. */
interface BlockPresentationProps {
  hidden: string[];
  /** Without their own frame and background, e.g. code blocks in a code group. */
  plain: string[];
}
/** A view's UI that stands for a block, e.g. a tab in a tab bar; each option is off by default. */
interface BlockAreaProps extends ParentProps {
  /** The block's node ID: a child's `key` from `children`, or the element's own `key`. */
  block: string;
  /** A right click selects the block and opens its editor menu, e.g. a tab's. */
  menu?: boolean;
  /** Dragging the UI moves the block, e.g. a callout by its icon or tabs by their buttons. */
  draggable?: boolean;
  /** Hovering the UI shows the block's drag handle and block menu, in the gutter. */
  controls?: boolean;
  /** A box selection selects the block by the UI, e.g. a tab by its button. */
  selectable?: boolean;
  /**
   * The view marks the block's selection itself, with `blockSelected`, so the editor draws no
   * block selection shade, e.g. for a hidden tab.
   */
  marksSelection?: boolean;
  /**
   * The block is a drop slot: a drop near it takes its place, e.g. a card in a grid, and the
   * editor's own drop positions are off in the element around it. With `"append"`, a drop goes at
   * the end of the block's content instead, e.g. a grid's "Add card" button with the grid's key.
   * Mark the target with `dropTarget`; the editor draws no drop indicator there.
   */
  droppable?: boolean | "append";
  /**
   * Enter or Space on the block, selected with the arrow keys, e.g. a tab button shows its tab;
   * without it, Enter opens the block's menu. Clicks are the UI's own, e.g. a button's `onClick`.
   */
  onActivate?(): void;
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
  emptyLabel?: string;
  /** Shown with `emptyLabel` while the list is empty. */
  emptyIcon?: string;
  disabled?: boolean;
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
interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
}
interface NavigationSection {
  label?: string;
  items: NavigationItem[];
}
interface NavigationProps {
  sections: NavigationSection[];
  /** The active item, e.g. the open page; it shows the selection gradient. */
  selected?: string;
  onSelect?(id: string): void;
}
/** A panel row; `tone` colors the icon, e.g. `warning` for a run with skipped files. */
interface ItemProps extends ParentProps {
  label: string;
  /** Parts of the line under the label, e.g. a commit and counts, shown with lines between. */
  details?: string[];
  /** An ISO date-time, first in the details line, e.g. "2 hours ago" with the date in a tooltip. */
  date?: string;
  icon?: string;
  /** Defaults to `muted`; `primary` has the brand gradient. */
  tone?: StatusTone;
  disabled?: boolean;
  /** Makes the row clickable; the children are actions shown on hover. */
  onClick?(): void;
}
/**
 * An `Item`'s details, under it while it's open, as the app's webhook events; the `Item` opens
 * and closes on a click.
 */
interface ItemDetailsProps extends ParentProps {
  /** Open at first, e.g. for a failed build. */
  open?: boolean;
}
/** `Item` rows under a small header, as a `Navigation` section; what follows is 12px away. */
interface ItemGroupProps extends ParentProps {
  label?: string;
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
/** A notice as the app's; `Button` and `IconButton` children are its actions, on the right. */
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
  /** Output such as a build log: plain monospace text without the box, scrolled when tall. */
  log?: boolean;
}
interface TimeAgoProps {
  /** An ISO date-time. */
  date: string;
}
type Gap = "none" | "small" | "medium" | "large";
type Size = "small" | "medium" | "large";
type Tone = "default" | "muted" | "danger" | "success";
/** A status shown by an icon's color, e.g. of an `Item` or a `Badge`. */
type StatusTone = "muted" | "primary" | "success" | "warning" | "danger";
type EmptyProps = Record<string, never>;
/** Small by default; `class` changes its size, e.g. `h-6 w-6`. */
type SpinnerProps = StyleProps;
/**
 * A line of text by default; `class` changes its size and shape, e.g. `h-7` for a field or
 * `h-5 w-5 rounded-md` for an icon.
 */
type SkeletonProps = StyleProps;

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
/** A labelled group of a page's `Setting` rows, as in Andesine's settings. */
const Section = hostComponent<SectionProps>("Section");
/**
 * The footer of a page's form, as in the app's settings: a line, a discard icon button, and the
 * save button. Put it last, after the form's sections.
 */
const SaveBar = hostComponent<SaveBarProps>("SaveBar");
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
/** Choose several options, shown as tags, as the editor's multi-select properties. */
const MultiSelect = hostComponent<MultiSelectProps>("MultiSelect");
/** In a `Setting` as its only control, the whole setting row toggles it. */
const Checkbox = hostComponent<ToggleProps>("Checkbox");
const Toggle = hostComponent<ToggleProps>("Toggle");
const ToggleGroup = hostComponent<ToggleGroupProps>("ToggleGroup");
const ColorInput = hostComponent<ColorInputProps>("ColorInput");
/** Choose or drop an image; shows a preview of `value` and the host's errors for the format and size. */
const ImageInput = hostComponent<ImageInputProps>("ImageInput");
/** Choose an icon of the given Iconify sets, with a search; sets load when they show. */
const IconPicker = hostComponent<IconPickerProps>("IconPicker");
/** Search the workspace's entries or type a URL; an entry link shows the entry's title. */
const LinkInput = hostComponent<LinkInputProps>("LinkInput");
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
/** Links in sections, like the app's settings menu, e.g. a panel's links to the extension's pages. */
const Navigation = hostComponent<NavigationProps>("Navigation");
const Item = hostComponent<ItemProps>("Item");
const ItemGroup = hostComponent<ItemGroupProps>("ItemGroup");
const ItemDetails = hostComponent<ItemDetailsProps>("ItemDetails");
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
const ContentSlot = hostComponent<ContentSlotProps>("ContentSlot");
const BlockPresentation = hostComponent<BlockPresentationProps>("BlockPresentation");
/** UI of a block in an element view, e.g. a tab's button, with the block's editor behaviors. */
const BlockArea = hostComponent<BlockAreaProps>("BlockArea");

export {
  Stack,
  Grid,
  Box,
  Divider,
  ScrollArea,
  Section,
  SaveBar,
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
  MultiSelect,
  Checkbox,
  Toggle,
  ToggleGroup,
  ColorInput,
  ImageInput,
  IconPicker,
  LinkInput,
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
  Navigation,
  Item,
  ItemGroup,
  ItemDetails,
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
  ContentSlot,
  BlockPresentation,
  BlockArea
};
export type {
  StackProps,
  GridProps,
  BoxProps,
  ScrollAreaProps,
  SectionProps,
  SaveBarProps,
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
  MultiSelectProps,
  ToggleProps,
  ToggleGroupProps,
  ColorInputProps,
  ImageFile,
  ImageInputProps,
  IconPickerProps,
  LinkInputProps,
  TooltipProps,
  DialogProps,
  MenuProps,
  MenuItemProps,
  MenuGroupProps,
  SettingProps,
  ListProps,
  CardProps,
  TreeItem,
  NavigationItem,
  NavigationProps,
  ItemProps,
  ItemGroupProps,
  ItemDetailsProps,
  NavigationSection,
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
  Option,
  ContentSlotProps,
  BlockPresentationProps,
  BlockAreaProps
};
