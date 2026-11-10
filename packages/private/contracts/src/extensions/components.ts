import * as z from "zod";
import { extensionIconType } from "./contributions";
import {
  imageDataURLType,
  imageFileType,
  imageFormatType,
  MAX_EXTENSION_IMAGE_SIZE
} from "./image-input";
import {
  noArguments,
  labelType,
  sizeType,
  gapType,
  menuPlacementType,
  menuItemParents,
  toneType,
  statusToneType,
  classType,
  httpsURLType,
  optionsType,
  buttonProps,
  fieldProps,
  choiceProps,
  toggleProps,
  treeItemsType,
  iconSetType
} from "./component-types";

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
  /** Page layout, as in settings: sections of `Setting` rows. */
  Section: {
    props: z.strictObject({ title: labelType }),
    events: {},
    children: true
  },
  /** A form's footer, as in the app's settings, last on the page; `dirty` enables its buttons. */
  SaveBar: {
    props: z.strictObject({
      dirty: z.boolean(),
      saving: z.boolean().optional(),
      message: z.string().max(200).optional(),
      saveLabel: z.string().max(50).optional()
    }),
    events: { onSave: noArguments, onDiscard: noArguments },
    children: false
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
  /** A white outlined status badge, as the app's webhook deliveries; the tone colors its icon. */
  Badge: {
    props: z.strictObject({
      icon: extensionIconType.optional(),
      tone: statusToneType.optional()
    }),
    events: {},
    children: true
  },
  Icon: {
    props: z.strictObject({
      name: extensionIconType,
      size: sizeType.optional(),
      tone: toneType.optional(),
      class: classType
    }),
    events: {},
    children: false
  },
  // Controls
  Button: {
    props: z.strictObject({
      ...buttonProps,
      loading: z.boolean().optional(),
      /** After the label, e.g. `i-lucide:plus` on a setting's main action. */
      icon: extensionIconType.optional()
    }),
    events: { onClick: noArguments },
    children: true
  },
  IconButton: {
    props: z.strictObject({ ...buttonProps, icon: extensionIconType, label: z.string().max(100) }),
    events: { onClick: noArguments },
    children: false
  },
  Input: {
    props: z.strictObject({
      ...fieldProps,
      type: z.enum(["text", "url", "number"]).optional(),
      /** Fixed text inside the field after the value, e.g. `.example.com` after a subdomain. */
      suffix: z.string().max(50).optional()
    }),
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
  MultiSelect: {
    props: z.strictObject({
      values: z.array(z.string().max(200)).max(100).optional(),
      options: optionsType,
      placeholder: z.string().max(200).optional(),
      disabled: z.boolean().optional()
    }),
    events: { onChange: z.tuple([z.array(z.string().max(200)).max(100)]) },
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
      presets: z
        .array(z.string().regex(/^#[\da-f]{6}$/i))
        .max(12)
        .optional(),
      disabled: z.boolean().optional()
    }),
    events: { onInput: z.tuple([z.string()]) },
    children: false
  },
  ImageInput: {
    props: z.strictObject({
      /** The current image for the preview: a declared HTTPS URL or an image data URL. */
      value: z.union([httpsURLType, imageDataURLType]).optional(),
      accept: z.array(imageFormatType).min(1).max(6).optional(),
      maxSize: z.number().int().min(1).max(MAX_EXTENSION_IMAGE_SIZE).optional(),
      disabled: z.boolean().optional()
    }),
    events: { onChange: z.tuple([imageFileType]), onRemove: noArguments },
    children: false
  },
  IconPicker: {
    props: z.strictObject({
      /** An icon class, e.g. `i-lucide:link`, or empty for none. */
      value: z.union([extensionIconType, z.literal("")]).optional(),
      /** The sets listed together, in this order; Lucide by default. */
      sets: z.array(iconSetType).min(1).max(4).optional(),
      placeholder: z.string().max(200).optional(),
      disabled: z.boolean().optional(),
      /** A button that removes the icon, e.g. for an optional one. */
      clearable: z.boolean().optional(),
      /** A square button with only the icon, e.g. before a field in a row. */
      compact: z.boolean().optional()
    }),
    events: { onChange: z.tuple([z.union([extensionIconType, z.literal("")])]) },
    children: false
  },
  LinkInput: {
    props: z.strictObject({
      /** An `entry:<entryID>` link, a URL, or a path when `paths` is set. */
      value: z.string().max(2000).optional(),
      placeholder: z.string().max(200).optional(),
      /** Also takes paths, e.g. `/blog` on a site. */
      paths: z.boolean().optional(),
      /** Lists only the entries in this collection, at any depth, e.g. a site's. */
      collectionID: z.string().max(100).optional(),
      disabled: z.boolean().optional()
    }),
    events: { onChange: z.tuple([z.string().max(2000)]) },
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
      emptyLabel: z.string().max(200).optional(),
      /** Shown with `emptyLabel` while the list is empty. */
      emptyIcon: extensionIconType.optional(),
      disabled: z.boolean().optional()
    }),
    events: {
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
  /** Links in sections, like the app's settings menu, e.g. a panel's links to the pages. */
  Navigation: {
    props: z.strictObject({
      sections: z
        .array(
          z.strictObject({
            label: labelType.optional(),
            items: z
              .array(
                z.strictObject({
                  id: z.string().min(1).max(100),
                  label: labelType,
                  icon: extensionIconType.optional()
                })
              )
              .min(1)
              .max(20)
          })
        )
        .max(10),
      selected: z.string().max(100).optional()
    }),
    events: { onSelect: z.tuple([z.string()]) },
    children: false
  },
  /**
   * A row of a panel, like the app's version rows: an icon whose tone shows a status, a label, a
   * line of details, and actions (the children) shown on hover.
   */
  Item: {
    props: z.strictObject({
      label: labelType,
      /** Parts of the line under the label, e.g. a commit and counts, with lines between them. */
      details: z.array(z.string().max(200)).max(8).optional(),
      /** Shown first in the details line, relative, with the date in a tooltip. */
      date: z.iso.datetime().optional(),
      icon: extensionIconType.optional(),
      tone: statusToneType.optional(),
      disabled: z.boolean().optional()
    }),
    events: { onClick: noArguments },
    children: true
  },
  /**
   * An `Item`'s details, shown under it when it's opened, as the app's webhook events; the `Item`
   * opens and closes on a click.
   */
  ItemDetails: {
    props: z.strictObject({ open: z.boolean().optional() }),
    events: {},
    children: true,
    parents: ["Item"]
  },
  /** `Item` rows under a small header, as a `Navigation` section; what follows is 12px away. */
  ItemGroup: {
    props: z.strictObject({ label: labelType.optional() }),
    events: {},
    children: true
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
  /**
   * A notice as the app's: a status icon, the title and text, and `Button` or `IconButton` children
   * as its actions on the right.
   */
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
      language: z.string().max(50).optional(),
      /** Output such as a build log: plain monospace text without the box, scrolled when tall. */
      log: z.boolean().optional()
    }),
    events: {},
    children: false
  },
  TimeAgo: { props: z.strictObject({ date: z.iso.datetime() }), events: {}, children: false },
  Spinner: { props: z.strictObject({ class: classType }), events: {}, children: false },
  /**
   * The host-owned editable content of an element view; at most one renders per view. Its children
   * are only content presentations, e.g. `BlockPresentation`, which render nothing.
   */
  ContentSlot: {
    props: z.strictObject({
      /** Shown while the content is empty. */
      placeholder: z.string().max(200).optional(),
      /** Utility classes on the slot, e.g. `contents` to lay the content out with the view's UI. */
      class: classType,
      /** Utility classes on the element's content itself, e.g. a grid of cards. */
      contentClass: classType,
      /** The content's blocks have the editor's drag handle and block menu, e.g. a tab's text. */
      controls: z.boolean().optional()
    }),
    events: {},
    children: true
  },
  /** The presentation of the slot's child blocks by node ID; the SDK's `<Block>` renders it. */
  BlockPresentation: {
    props: z.strictObject({
      hidden: z.array(z.string().max(64)).max(500),
      /** Without their own frame and background, e.g. code blocks in a code group. */
      plain: z.array(z.string().max(64)).max(500)
    }),
    events: {},
    children: false,
    parents: ["ContentSlot"]
  },
  /** A view's UI that stands for a block, e.g. a tab; each option turns on one editor behavior. */
  BlockArea: {
    props: z.strictObject({
      block: z.string().min(1).max(64),
      menu: z.boolean().optional(),
      draggable: z.boolean().optional(),
      controls: z.boolean().optional(),
      selectable: z.boolean().optional(),
      marksSelection: z.boolean().optional(),
      droppable: z.union([z.boolean(), z.literal("append")]).optional()
    }),
    events: { onActivate: noArguments },
    children: true
  },
  Skeleton: {
    props: z.strictObject({ class: classType }),
    events: {},
    children: false
  }
} satisfies Record<string, ExtensionComponentDefinition>;

export { extensionComponentDefinitions };
export type { ExtensionComponentDefinition, ExtensionComponentName, ExtensionComponentProps };
