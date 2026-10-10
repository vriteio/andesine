import * as z from "zod";
import { uniqueItems } from "../webhooks/events";
import { extensionIconType } from "./contributions";

interface ExtensionComponentDefinition {
  props: z.ZodObject;
  /** Callback props and the values the host passes to them. */
  events: Record<string, z.ZodType<unknown[]>>;
  children: boolean;
  /** Components that can contain this one; any parent when unset. */
  parents?: string[];
}

type ExtensionComponentName = keyof typeof extensionComponentDefinitions;
type ExtensionComponentProps<N extends ExtensionComponentName> = z.input<
  (typeof extensionComponentDefinitions)[N]["props"]
>;

const MAX_OPTIONS = 100;
const MAX_TREE_ITEMS = 500;
const noArguments = z.tuple([]);
const labelType = z.string().max(200);
const sizeType = z.enum(["small", "medium", "large"]);
const gapType = z.enum(["none", "small", "medium", "large"]);
const menuPlacementType = z.enum([
  "bottom-start",
  "bottom-end",
  "top-start",
  "top-end",
  "right-start",
  "left-start"
]);
const menuItemParents = ["Menu", "MenuItem", "MenuGroup"];
const toneType = z.enum(["default", "muted", "danger", "success"]);
/** Utility classes of the shared UnoCSS preset; the extension build generates their CSS. */
const classType = z
  .string()
  .max(500)
  .regex(/^[\w:./\-[\]%#! ]*$/, "Use utility classes")
  .optional();
const httpsURLType = z.url({ protocol: /^https$/ }).max(2048);
const optionsType = z
  .array(z.strictObject({ value: z.string().max(200), label: labelType }))
  .max(MAX_OPTIONS)
  .refine((options) => uniqueItems(options.map(({ value }) => value)), "Values must be unique");
const buttonProps = {
  variant: z.enum(["primary", "secondary", "ghost", "link", "danger"]).optional(),
  size: z.enum(["small", "medium"]).optional(),
  disabled: z.boolean().optional()
};
const fieldProps = {
  value: z.string().max(10_000).optional(),
  placeholder: z.string().max(200).optional(),
  label: z.string().max(100).optional(),
  disabled: z.boolean().optional()
};
const choiceProps = {
  value: z.string().max(200).optional(),
  options: optionsType,
  placeholder: z.string().max(200).optional(),
  disabled: z.boolean().optional()
};
const toggleProps = {
  checked: z.boolean().optional(),
  label: z.string().max(100).optional(),
  disabled: z.boolean().optional()
};
/** A flat tree; `parent` refers to another item ID, and items without a parent are top level. */
const treeItemsType = z
  .array(
    z.strictObject({
      id: z.string().min(1).max(100),
      label: labelType,
      icon: extensionIconType.optional(),
      parent: z.string().max(100).optional()
    })
  )
  .max(MAX_TREE_ITEMS)
  .refine((items) => uniqueItems(items.map(({ id }) => id)), "Item IDs must be unique");
/** Host components that extension views can render; part of the extension API version. */
const extensionComponentDefinitions = {
  // Layout
  Stack: {
    props: z.strictObject({
      direction: z.enum(["row", "column"]).optional(),
      gap: gapType.optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
      justify: z.enum(["start", "center", "end", "between"]).optional(),
      wrap: z.boolean().optional(),
      class: classType
    }),
    events: {},
    children: true
  },
  Grid: {
    props: z.strictObject({
      columns: z.int().min(1).max(4).optional(),
      gap: gapType.optional(),
      class: classType
    }),
    events: {},
    children: true
  },
  Box: {
    props: z.strictObject({
      padding: gapType.optional(),
      background: z.enum(["none", "soft", "contrast"]).optional(),
      border: z.boolean().optional(),
      class: classType
    }),
    events: {},
    children: true
  },
  Divider: { props: z.strictObject({}), events: {}, children: false },
  ScrollArea: {
    props: z.strictObject({ maxHeight: sizeType.optional() }),
    events: {},
    children: true
  },
  // Text
  Text: {
    props: z.strictObject({
      size: z.enum(["xs", "sm", "base", "lg"]).optional(),
      weight: z.enum(["normal", "medium", "semibold"]).optional(),
      tone: toneType.optional(),
      class: classType
    }),
    events: {},
    children: true
  },
  Heading: {
    props: z.strictObject({
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      class: classType
    }),
    events: {},
    children: true
  },
  Code: { props: z.strictObject({}), events: {}, children: true },
  Link: { props: z.strictObject({ href: httpsURLType }), events: {}, children: true },
  Badge: {
    props: z.strictObject({ color: z.enum(["base", "primary", "danger", "success"]).optional() }),
    events: {},
    children: true
  },
  Icon: {
    props: z.strictObject({
      name: extensionIconType,
      size: sizeType.optional(),
      tone: toneType.optional()
    }),
    events: {},
    children: false
  },
  // Controls
  Button: {
    props: z.strictObject({ ...buttonProps, loading: z.boolean().optional() }),
    events: { onClick: noArguments },
    children: true
  },
  IconButton: {
    props: z.strictObject({ ...buttonProps, icon: extensionIconType, label: z.string().max(100) }),
    events: { onClick: noArguments },
    children: false
  },
  Input: {
    props: z.strictObject({ ...fieldProps, type: z.enum(["text", "url", "number"]).optional() }),
    events: { onInput: z.tuple([z.string()]), onEnter: noArguments },
    children: false
  },
  Textarea: {
    props: z.strictObject({ ...fieldProps, rows: z.int().min(2).max(20).optional() }),
    events: { onInput: z.tuple([z.string()]) },
    children: false
  },
  Select: {
    props: z.strictObject(choiceProps),
    events: { onChange: z.tuple([z.string()]) },
    children: false
  },
  Combobox: {
    props: z.strictObject(choiceProps),
    events: { onChange: z.tuple([z.string()]) },
    children: false
  },
  Checkbox: {
    props: z.strictObject(toggleProps),
    events: { onChange: z.tuple([z.boolean()]) },
    children: false
  },
  Toggle: {
    props: z.strictObject(toggleProps),
    events: { onChange: z.tuple([z.boolean()]) },
    children: false
  },
  ToggleGroup: {
    props: z.strictObject({
      value: z.string().max(200).optional(),
      options: optionsType.max(10),
      disabled: z.boolean().optional()
    }),
    events: { onChange: z.tuple([z.string()]) },
    children: false
  },
  ColorInput: {
    props: z.strictObject({
      value: z
        .string()
        .regex(/^#[\da-f]{6}$/i)
        .optional(),
      disabled: z.boolean().optional()
    }),
    events: { onInput: z.tuple([z.string()]) },
    children: false
  },
  Tooltip: {
    props: z.strictObject({ content: z.string().max(200) }),
    events: {},
    children: true
  },
  // Overlays. A block action view's root holds exactly one `Dialog` or `Menu` (or nothing).
  /** Shown while rendered; a dialog outside block actions needs a recent interaction. */
  Dialog: {
    props: z.strictObject({
      title: z.string().max(200),
      description: z.string().max(500).optional(),
      size: sizeType.optional(),
      dismissible: z.boolean().optional()
    }),
    events: { onClose: noArguments },
    children: true
  },
  /**
   * A dropdown menu, opened by its `MenuTrigger` (or, with `contextMenu`, by a right click on it);
   * at a block action view's root, it opens where the block menu was.
   */
  Menu: {
    props: z.strictObject({
      title: z.string().max(100).optional(),
      /** Controls the open state; without it, the menu opens and closes on its own. */
      opened: z.boolean().optional(),
      contextMenu: z.boolean().optional(),
      placement: menuPlacementType.optional(),
      size: z.enum(["small", "medium"]).optional()
    }),
    events: { onOpenChange: z.tuple([z.boolean()]) },
    children: true
  },
  MenuTrigger: { props: z.strictObject({}), events: {}, children: true, parents: ["Menu"] },
  /** Nested items make a submenu, which replaces `onSelect`. */
  MenuItem: {
    props: z.strictObject({
      label: z.string().min(1).max(200),
      icon: extensionIconType.optional(),
      /** Shown next to the label; the extension handles the keys. */
      shortcut: z.string().max(50).optional(),
      color: z.enum(["base", "danger"]).optional(),
      disabled: z.boolean().optional(),
      /** A spinner replaces the icon, and the item is disabled. */
      loading: z.boolean().optional(),
      selected: z.boolean().optional(),
      closeOnSelect: z.boolean().optional()
    }),
    events: { onSelect: noArguments },
    children: true,
    parents: menuItemParents
  },
  MenuGroup: {
    props: z.strictObject({ label: z.string().max(100).optional() }),
    events: {},
    children: true,
    parents: ["Menu", "MenuItem"]
  },
  MenuSeparator: {
    props: z.strictObject({}),
    events: {},
    children: false,
    parents: ["Menu", "MenuItem"]
  },
  /** A custom item: any content, e.g. a result or a form. */
  MenuContent: { props: z.strictObject({}), events: {}, children: true, parents: menuItemParents },
  // Settings
  Setting: {
    props: z.strictObject({
      label: z.string().max(100),
      description: z.string().max(500).optional()
    }),
    events: {},
    children: true
  },
  /** Each child is one item; the host adds remove and reorder controls. */
  List: {
    props: z.strictObject({
      addLabel: z.string().max(100).optional(),
      emptyLabel: z.string().max(200).optional(),
      disabled: z.boolean().optional()
    }),
    events: {
      onAdd: noArguments,
      onRemove: z.tuple([z.int().min(0)]),
      onMove: z.tuple([z.int().min(0), z.int().min(0)])
    },
    children: true
  },
  // Data display
  Card: {
    props: z.strictObject({ color: z.enum(["base", "contrast", "soft"]).optional() }),
    events: {},
    children: true
  },
  Tree: {
    props: z.strictObject({
      items: treeItemsType,
      selected: z.string().max(100).optional(),
      emptyLabel: z.string().max(200).optional()
    }),
    events: { onSelect: z.tuple([z.string()]) },
    children: false
  },
  Tabs: {
    props: z.strictObject({ value: z.string().max(200).optional() }),
    events: { onChange: z.tuple([z.string()]) },
    children: true
  },
  Tab: {
    props: z.strictObject({ value: z.string().max(200), label: z.string().max(100) }),
    events: {},
    children: true,
    parents: ["Tabs"]
  },
  Disclosure: {
    props: z.strictObject({ label: z.string().max(200), open: z.boolean().optional() }),
    events: {},
    children: true
  },
  Callout: {
    props: z.strictObject({
      tone: z.enum(["info", "warning", "danger", "success"]).optional(),
      title: z.string().max(200).optional()
    }),
    events: {},
    children: true
  },
  Steps: { props: z.strictObject({}), events: {}, children: true },
  Step: {
    props: z.strictObject({ title: z.string().max(200) }),
    events: {},
    children: true,
    parents: ["Steps"]
  },
  /** The image must be within the extension's declared request URLs. */
  Figure: {
    props: z.strictObject({
      src: httpsURLType,
      alt: z.string().max(500),
      caption: z.string().max(500).optional()
    }),
    events: {},
    children: false
  },
  CodeBlock: {
    props: z.strictObject({
      code: z.string().max(50_000),
      language: z.string().max(50).optional()
    }),
    events: {},
    children: false
  },
  TimeAgo: { props: z.strictObject({ date: z.iso.datetime() }), events: {}, children: false },
  Spinner: { props: z.strictObject({ size: sizeType.optional() }), events: {}, children: false },
  /** The host-owned editable content of an element view; at most one renders per view. */
  ContentSlot: { props: z.strictObject({}), events: {}, children: false },
  Skeleton: {
    props: z.strictObject({ height: sizeType.optional() }),
    events: {},
    children: false
  }
} satisfies Record<string, ExtensionComponentDefinition>;

export { extensionComponentDefinitions };
export type { ExtensionComponentDefinition, ExtensionComponentName, ExtensionComponentProps };
