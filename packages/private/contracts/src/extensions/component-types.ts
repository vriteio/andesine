import * as z from "zod";
import { uniqueItems } from "../webhooks/events";
import { extensionIconType } from "./contributions";

// Prop types shared by the host component definitions.
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
/** A status shown by an icon's color, e.g. of an `Item` or a `Badge`. */
const statusToneType = z.enum(["muted", "primary", "success", "warning", "danger"]);
/** Utility classes of the shared UnoCSS preset; the extension build generates their CSS. */
const classType = z
  .string()
  .max(2000)
  // `@` is for container variants, e.g. `@lg:grid-cols-2`, and `&>*+~()=` for arbitrary variants,
  // e.g. `[&>*:first-child]:mt-0`; the extension's CSS itself is validated separately.
  .regex(/^[\w:./\-[\]%#!@&>*+~()= ]*$/, "Use utility classes")
  .optional();
const httpsURLType = z.url({ protocol: /^https$/ }).max(2048);
const optionsType = z
  .array(z.strictObject({ value: z.string().max(200), label: labelType }))
  .max(MAX_OPTIONS)
  .refine((options) => uniqueItems(options.map(({ value }) => value)), "Values must be unique");
const buttonProps = {
  variant: z.enum(["primary", "secondary", "ghost", "link", "danger"]).optional(),
  size: z.enum(["small", "medium"]).optional(),
  disabled: z.boolean().optional(),
  class: classType
};
const fieldProps = {
  value: z.string().max(10_000).optional(),
  placeholder: z.string().max(200).optional(),
  label: z.string().max(100).optional(),
  disabled: z.boolean().optional(),
  /** Monospace, smaller text, e.g. for paths or glob patterns. */
  code: z.boolean().optional()
};
/** Iconify sets that the app bundles, e.g. for `IconPicker`. */
const iconSetType = z.enum(["lucide", "tabler", "simple-icons"]);
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

export {
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
};
