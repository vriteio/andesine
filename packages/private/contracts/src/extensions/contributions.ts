import { ELEMENT_BLOCKS, ELEMENT_TAG_NAME } from "@andesine/document";
import * as z from "zod";
import { uniqueItems } from "../webhooks/events";
import { extensionElementPropsType } from "./element-props";
import { extensionStorageLimits } from "./storage";

type ExtensionElementView = z.output<typeof extensionElementViewType>;
type ExtensionBlockAction = z.output<typeof extensionBlockActionType>;
type ExtensionPanel = z.output<typeof extensionPanelType>;
type ExtensionPage = z.output<typeof extensionPageType>;
type ExtensionPageWhen = z.output<typeof extensionPageWhenType>;

const extensionContributionLimits = {
  elementViews: 50,
  blockActions: 20,
  panelsPerSide: 2,
  pages: 5,
  subPages: 20
} as const;
/** Stable across versions; settings and managed records are keyed by it. */
const extensionStableIDType = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/, "Use a letter, then letters, digits, - or _");
const extensionViewNameType = z
  .string()
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/, "Use the name of a view of defineViews")
  .describe("The view of `defineViews` that renders this contribution");
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
/** The element's direct child blocks that its content accepts; without it, any blocks. */
const extensionElementAcceptsType = z
  .strictObject({
    /** Child elements by name, e.g. `Tab`. */
    elements: z
      .array(elementNameType)
      .max(20)
      .refine(uniqueItems, "Elements must be unique")
      .optional(),
    /** Standard blocks, e.g. `codeBlock`; elements are listed in `elements`. */
    blocks: z
      .array(
        z
          .string()
          .refine(
            (block) => block !== "element" && ELEMENT_BLOCKS.includes(block),
            "Unknown block type"
          )
      )
      .max(ELEMENT_BLOCKS.length)
      .refine(uniqueItems, "Blocks must be unique")
      .optional()
  })
  .optional();
/**
 * `children` are the descendant elements that the view draws with `<Element>` templates, inside
 * this root (nearest root first); they override those elements' own root views there.
 */
const extensionElementViewType = z
  .strictObject({
    id: extensionStableIDType,
    name: labelType,
    /** Shown in the editor's slash menu and the extension's settings. */
    description: z.string().min(1).max(200).optional(),
    /** The slash menu group, e.g. `Docs`; the same name groups elements of any extension. */
    category: z.string().trim().min(1).max(50).optional(),
    icon: extensionIconType.optional(),
    element: elementNameType,
    view: extensionViewNameType,
    /** Defaults to true with children. */
    content: z.boolean().optional(),
    accepts: extensionElementAcceptsType,
    /** Blocks that don't fit, even with `accepts`, e.g. no nested `Accordion`. */
    rejects: extensionElementAcceptsType,
    /** The props, in the menu's order; a new element gets their defaults. The view renders them. */
    props: extensionElementPropsType.optional(),
    children: z
      .array(
        z.strictObject({
          element: elementNameType,
          /** Offers the element in the slash menu, inside its root. */
          name: labelType.optional(),
          description: z.string().min(1).max(200).optional(),
          /** Defaults to the root's category. */
          category: z.string().trim().min(1).max(50).optional(),
          icon: extensionIconType.optional(),
          /** Defaults to true. */
          content: z.boolean().optional(),
          accepts: extensionElementAcceptsType,
          rejects: extensionElementAcceptsType,
          props: extensionElementPropsType.optional()
        })
      )
      .max(20)
      .refine(
        (children) => uniqueItems(children.map(({ element }) => element.toLowerCase())),
        "Use one entry per child element"
      )
      .default([])
  })
  .refine((view) => view.content !== false || !view.children.some(({ name }) => name), {
    message: "Named children are inserted in the content, so the view needs content",
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
  view: extensionViewNameType
});
const panelType = { id: extensionStableIDType, name: labelType, icon: extensionIconType };
const extensionPanelType = z.discriminatedUnion("side", [
  z.strictObject({ ...panelType, side: z.literal("left"), view: extensionViewNameType }),
  z.strictObject({
    ...panelType,
    side: z.literal("right"),
    context: z.enum(["workspace", "collection", "entry"]),
    view: extensionViewNameType
  })
]);
/**
 * A storage key with the page's context IDs, e.g. `mapping:{publishingCollectionID}`; it starts
 * with fixed text, which the host lists the keys by.
 */
const extensionPageStorageKeyType = z
  .string()
  .max(extensionStorageLimits.keyLength)
  .regex(
    /^[^{}\p{Cc}]+(?:\{(?:collectionID|entryID|publishingCollectionID)\}[^{}\p{Cc}]*)*$/u,
    "Start with fixed text; use only {collectionID}, {entryID}, or {publishingCollectionID}"
  );
/**
 * When the page is available, in menus, links, and `openPage`; all conditions must hold. The host
 * checks them, without running the extension.
 */
const extensionPageWhenType = z.strictObject({
  /** Whether the collection or one around it has publishing on. */
  publishing: z.boolean().optional(),
  /** Whether a key of the extension's storage exists, e.g. a mapping that its backend saves. */
  storage: z.strictObject({ key: extensionPageStorageKeyType, exists: z.boolean() }).optional()
});
/** A view in the main content area, e.g. settings too large for a panel. */
const extensionPageType = z.strictObject({
  ...panelType,
  context: z.enum(["workspace", "collection", "entry"]),
  /** Marks the page's collection or entry as open in the explorer while the page shows. */
  highlightContext: z.boolean().optional(),
  /**
   * A page without a parent that this page is under, e.g. a group of its settings: it isn't in
   * menus, `openPage` opens it, and its title follows the parent's.
   */
  parent: extensionStableIDType.optional(),
  when: extensionPageWhenType.optional(),
  view: extensionViewNameType
});
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
    .default([]),
  pages: z
    .array(extensionPageType)
    .superRefine((pages, context) => {
      const { pages: maxPages, subPages: maxSubPages } = extensionContributionLimits;
      const topLevel = pages.filter(({ parent }) => !parent);

      if (topLevel.length > maxPages) {
        context.addIssue({
          code: "custom",
          message: `Use at most ${maxPages} pages without a parent`
        });
      }

      if (pages.length - topLevel.length > maxSubPages) {
        context.addIssue({
          code: "custom",
          message: `Use at most ${maxSubPages} pages with a parent`
        });
      }

      pages.forEach((page, index) => {
        const parent = page.parent && topLevel.find(({ id }) => id === page.parent);
        const key = page.when?.storage?.key ?? "";
        const usesCollection = page.when?.publishing !== undefined || /\{(?!entryID)/.test(key);
        const isMissingContext =
          (page.context === "workspace" && usesCollection) ||
          (page.context !== "entry" && key.includes("{entryID}"));

        if (isMissingContext) {
          context.addIssue({
            code: "custom",
            path: [index, "when"],
            message: "Use only conditions of the page's context"
          });
        }

        if (page.parent && !parent) {
          context.addIssue({
            code: "custom",
            path: [index, "parent"],
            message: "Use the ID of a page without a parent"
          });
        } else if (parent && parent.context !== page.context) {
          context.addIssue({
            code: "custom",
            path: [index, "context"],
            message: "Use the parent page's context"
          });
        }
      });
    })
    .default([])
};

export {
  extensionContributionLimits,
  extensionStableIDType,
  extensionIconType,
  extensionElementViewType,
  extensionElementAcceptsType,
  extensionBlockActionType,
  extensionPanelType,
  extensionPageType,
  extensionPageWhenType,
  extensionContributionsType
};
export type {
  ExtensionElementView,
  ExtensionBlockAction,
  ExtensionPanel,
  ExtensionPage,
  ExtensionPageWhen
};
