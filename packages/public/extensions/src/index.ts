import { type ExtensionManifestInput } from "@andesine/contracts/extensions";
import type {
  BlockActionProps,
  ElementViewProps,
  PagePropsByContext,
  RightPanelPropsByContext,
  ViewRef
} from "./views";

/** Options of `andesine extensions build`, exported from the config file as `build`. */
interface ExtensionBuildOptions {
  /** The module whose default export is `defineViews` (default: `src/views.tsx`). */
  frontend?: string;
  /** Custom icon sets: a set prefix and a directory of SVG files, e.g. `{ acme: "./icons" }`. */
  icons?: Record<string, string>;
}

type ViewContributionKey = "elementViews" | "blockActions" | "panels" | "pages";
type ManifestList<Key extends ViewContributionKey> = NonNullable<
  ExtensionManifestInput[Key]
>[number];
/** A contribution whose view must accept the props that it gets. */
type WithView<Contribution, Props> = Omit<Contribution, "view"> & { view: ViewRef<Props> };
type PanelDefinition<Panel = ManifestList<"panels">> = Panel extends { side: "left" }
  ? WithView<Panel, Record<never, never>>
  : Panel extends { context: infer Context extends keyof RightPanelPropsByContext }
    ? Context extends keyof RightPanelPropsByContext
      ? WithView<Omit<Panel, "context"> & { context: Context }, RightPanelPropsByContext[Context]>
      : never
    : never;
type PageDefinition<Page = ManifestList<"pages">> = Page extends {
  context: infer Context extends keyof PagePropsByContext;
}
  ? Context extends keyof PagePropsByContext
    ? WithView<Omit<Page, "context"> & { context: Context }, PagePropsByContext[Context]>
    : never
  : never;
/**
 * The manifest as authored. Views are `ViewRef`s of `viewRefs`, e.g. `View.SitePanel`.
 * `configuration` and each view's `props` take an array of fields, or one combined schema whose
 * order the fields keep: a JSON Schema object, or a schema library's schema with Standard JSON
 * Schema, e.g. a Zod object; the build converts it to the array.
 */
type ExtensionDefinition = Omit<ExtensionManifestInput, ViewContributionKey> & {
  elementViews?: Array<WithView<ManifestList<"elementViews">, ElementViewProps>>;
  blockActions?: Array<WithView<ManifestList<"blockActions">, BlockActionProps>>;
  panels?: PanelDefinition[];
  pages?: PageDefinition[];
};

/** Defines the `andesine.config.ts` manifest. */
const defineExtension = (definition: ExtensionDefinition): ExtensionDefinition => definition;
const defineBuild = (options: ExtensionBuildOptions): ExtensionBuildOptions => options;

export { defineExtension, defineBuild };
export { viewRefs } from "./views";
export type { ExtensionDefinition, ExtensionBuildOptions };
export type {
  Views,
  ViewRef,
  WorkspacePanelProps,
  CollectionPanelProps,
  EntryPanelProps,
  CollectionPageProps,
  EntryPageProps,
  BlockActionProps,
  ElementViewProps
} from "./views";
