import { ELEMENT_BLOCKS, ELEMENT_NAME, ELEMENT_TAG_NAME } from "@andesine/document";
import * as z from "zod";
import { uniqueItems } from "../webhooks/events";

type ExtensionElementView = z.output<typeof extensionElementViewType>;
type ExtensionBlockAction = z.output<typeof extensionBlockActionType>;
type ExtensionPanel = z.output<typeof extensionPanelType>;

const extensionContributionLimits = {
  elementViews: 50,
  blockActions: 20,
  panelsPerSide: 2
} as const;
/** Stable across versions; settings and managed records are keyed by it. */
const extensionStableIDType = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/, "Use a letter, then letters, digits, - or _");
const extensionEntryType = z
  .string()
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/, "Use the name of an exported view")
  .describe("The export of the frontend bundle that renders this contribution");
/** UnoCSS icon class, e.g. `i-lucide:rocket` (`?bg` for colored); the build checks it exists. */
const extensionIconType = z
  .string()
  .max(120)
  .regex(
    /^i-[a-z\d]+(?:-[a-z\d]+)*:[a-z\d]+(?:-[a-z\d]+)*(?:\?(?:bg|mask))?$/,
    "Use an icon class, e.g. i-lucide:rocket"
  );
const labelType = z.string().min(1).max(60);
const elementNameType = z
  .string()
  .max(100)
  .regex(ELEMENT_TAG_NAME, "Use an element name, e.g. Accordion");
const MAX_ELEMENT_PROPS_LENGTH = 2000;
/** Props of an element inserted from the slash menu. */
const elementPropsType = z
  .record(z.string().regex(ELEMENT_NAME, "Use a prop name, e.g. title"), z.json())
  .refine(
    (props) => JSON.stringify(props).length <= MAX_ELEMENT_PROPS_LENGTH,
    "Props are too large"
  )
  .optional();
/** `descendants` override their elements' own root views inside this root (nearest root first). */
const extensionElementViewType = z
  .strictObject({
    id: extensionStableIDType,
    name: labelType,
    /** Shown in the editor's slash menu and the extension's settings. */
    description: z.string().min(1).max(200).optional(),
    icon: extensionIconType.optional(),
    element: elementNameType,
    entry: extensionEntryType,
    /** Defaults to true with descendants. */
    content: z.boolean().optional(),
    props: elementPropsType,
    descendants: z
      .array(
        z.strictObject({
          element: elementNameType,
          entry: extensionEntryType,
          /** Offers the element in the slash menu, inside its root. */
          name: labelType.optional(),
          description: z.string().min(1).max(200).optional(),
          icon: extensionIconType.optional(),
          /** Defaults to true. */
          content: z.boolean().optional(),
          props: elementPropsType
        })
      )
      .max(20)
      .refine(
        (descendants) => uniqueItems(descendants.map(({ element }) => element.toLowerCase())),
        "Use one view per descendant element"
      )
      .default([])
  })
  .refine((view) => view.content !== false || !view.descendants.some(({ name }) => name), {
    message: "Named descendants are inserted in the content, so the view needs content",
    path: ["content"]
  });
const extensionBlockActionType = z.strictObject({
  id: extensionStableIDType,
  label: labelType,
  icon: extensionIconType.optional(),
  blocks: z
    .array(z.string().refine((block) => ELEMENT_BLOCKS.includes(block), "Unknown block type"))
    .min(1)
    .max(ELEMENT_BLOCKS.length)
    .refine(uniqueItems, "Blocks must be unique"),
  entry: extensionEntryType
});
const panelType = { id: extensionStableIDType, name: labelType, icon: extensionIconType };
const extensionPanelType = z.discriminatedUnion("side", [
  z.strictObject({ ...panelType, side: z.literal("left"), entry: extensionEntryType }),
  z.strictObject({
    ...panelType,
    side: z.literal("right"),
    context: z.enum(["workspace", "collection", "entry"]),
    entry: extensionEntryType
  })
]);
const extensionContributionsType = {
  elementViews: z
    .array(extensionElementViewType)
    .max(extensionContributionLimits.elementViews)
    .refine(
      (views) => uniqueItems(views.map(({ element }) => element.toLowerCase())),
      "Use one view per element"
    )
    .default([]),
  blockActions: z
    .array(extensionBlockActionType)
    .max(extensionContributionLimits.blockActions)
    .default([]),
  panels: z
    .array(extensionPanelType)
    .refine((panels) => {
      return ["left", "right"].every((side) => {
        const count = panels.filter((panel) => panel.side === side).length;

        return count <= extensionContributionLimits.panelsPerSide;
      });
    }, `Use at most ${extensionContributionLimits.panelsPerSide} panels per side`)
    .default([])
};

export {
  extensionContributionLimits,
  extensionStableIDType,
  extensionIconType,
  extensionElementViewType,
  extensionBlockActionType,
  extensionPanelType,
  extensionContributionsType
};
export type { ExtensionElementView, ExtensionBlockAction, ExtensionPanel };
