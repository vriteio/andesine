import type { Component } from "solid-js";
import type { ContentNode } from "./solid/editor";
import type { ElementTemplateProps } from "./solid/templates";

declare const viewsBrand: unique symbol;
declare const viewRefBrand: unique symbol;

/**
 * The views of `defineViews`, which the frontend runs. Outside the sandbox it's only a type, for
 * `viewRefs`: `import type { Views } from "./src/views"`.
 */
interface Views<Components extends ViewComponents> {
  readonly [viewsBrand]: Components;
}
/** Props of panels by side and context; right panels also get the open page of the extension. */
interface WorkspacePanelProps {
  pageID?: string;
}
interface CollectionPanelProps extends WorkspacePanelProps {
  collectionID: string;
  entryID?: string;
  /** The nearest collection with publishing on, the open one or one around it. */
  publishingCollectionID?: string;
}
interface EntryPanelProps extends WorkspacePanelProps {
  collectionID: string;
  entryID: string;
  publishingCollectionID?: string;
}
/** Props of pages by context. */
interface CollectionPageProps {
  collectionID: string;
  publishingCollectionID?: string;
}
interface EntryPageProps {
  entryID: string;
  publishingCollectionID?: string;
}
/** A block action's view gets the selected blocks. */
interface BlockActionProps {
  blocks: ContentNode[];
}

// The props of each side and context; a view must accept them.
interface RightPanelPropsByContext {
  workspace: WorkspacePanelProps;
  collection: CollectionPanelProps;
  entry: EntryPanelProps;
}
interface PagePropsByContext {
  workspace: Record<never, never>;
  collection: CollectionPageProps;
  entry: EntryPageProps;
}

// `any`: a component of any props, e.g. an element view of its own props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViewComponents = Record<string, Component<any>>;
/**
 * A manifest's view, e.g. `View.SitePanel` of `viewRefs`; it's the view's name and carries its
 * props, so a view that doesn't accept a contribution's props is a type error.
 */
type ViewRef<Props> = string & { readonly [viewRefBrand]: (props: Props) => void };
type ViewProps<C> = C extends (props: infer Props) => unknown ? Props : never;
type ViewRefs<V> =
  V extends Views<infer Components>
    ? { readonly [Name in keyof Components & string]: ViewRef<ViewProps<Components[Name]>> }
    : never;
/** An element view's props, of any element props. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementViewProps = ElementTemplateProps<any>;

/**
 * The views of a `Views` type for the manifest: `const View = viewRefs<Views>()`, then e.g.
 * `view: View.SitePanel`. At run time each is the view's name.
 */
const viewRefs = <V extends Views<ViewComponents>>(): ViewRefs<V> => {
  return new Proxy({} as ViewRefs<V>, {
    get: (_, name) => (typeof name === "string" && name !== "then" ? name : undefined)
  });
};

export { viewRefs };
export type {
  Views,
  ViewComponents,
  ViewRef,
  ViewRefs,
  WorkspacePanelProps,
  CollectionPanelProps,
  EntryPanelProps,
  CollectionPageProps,
  EntryPageProps,
  BlockActionProps,
  ElementViewProps,
  RightPanelPropsByContext,
  PagePropsByContext
};
