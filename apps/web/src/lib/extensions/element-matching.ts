import {
  type ExtensionActiveView,
  type ExtensionElementPropFields,
  type ExtensionElementView
} from "@andesine/contracts/extensions";

interface ElementViewSource<T> {
  extension: T;
  extensionID: string;
  views: ExtensionElementView[];
}
interface ElementRoot<T> {
  extension: T;
  view: ExtensionElementView;
}
interface ElementViewMatch<T> {
  extension: T;
  /** The view's own entry, or the root view's template for the element. */
  view: { name: string } | { template: string };
  /** The props, which the props menu edits; a new element gets their defaults. */
  props?: ExtensionElementPropFields;
  accepts?: ExtensionElementView["accepts"];
  rejects?: ExtensionElementView["rejects"];
  /** False for elements without content, e.g. `<File />`. */
  content: boolean;
}

type RootFinder<T> = (element: string) => ElementRoot<T> | null;

const sameName = (left: string, right: string): boolean => {
  return left.toLowerCase() === right.toLowerCase();
};
/** Finds an element's root view from the active view index; the extension must be running. */
const createRootFinder = <T>(
  sources: Array<ElementViewSource<T>>,
  activeViews: ExtensionActiveView[]
): RootFinder<T> => {
  return (element) => {
    const indexed = activeViews.find(({ selector }) => selector === element.toLowerCase());
    const source = indexed && sources.find((item) => item.extensionID === indexed.extensionID);
    const view = source?.views.find(({ id }) => id === indexed?.viewID);

    return source && view ? { extension: source.extension, view } : null;
  };
};
/** Prefers the nearest root view's template for the element, then the element's own root view. */
const matchElementView = <T>(
  findRoot: RootFinder<T>,
  name: string,
  ancestors: string[]
): ElementViewMatch<T> | null => {
  for (const ancestor of ancestors) {
    const root = findRoot(ancestor);

    if (!root) continue;

    const child = root.view.children.find(({ element }) => sameName(element, name));

    if (child) {
      return {
        extension: root.extension,
        view: { template: child.element },
        props: child.props,
        accepts: child.accepts,
        rejects: child.rejects,
        content: child.content ?? true
      };
    }

    break;
  }

  const own = findRoot(name);

  return own
    ? {
        extension: own.extension,
        view: { name: own.view.view },
        props: own.view.props,
        accepts: own.view.accepts,
        rejects: own.view.rejects,
        content: own.view.content ?? own.view.children.length > 0
      }
    : null;
};

/**
 * Where an element that only a root view's template draws may be: directly inside that root, or
 * inside another of its templates that accepts it, e.g. a `Folder` in a `Folder`. Null for
 * elements with their own root view, which can be anywhere.
 */
const getTemplateParents = <T>(
  findRoot: RootFinder<T>,
  roots: string[],
  name: string
): string[] | null => {
  if (findRoot(name)) return null;

  const parents = roots.flatMap((element) => {
    const root = findRoot(element);
    const isTemplate = root?.view.children.some((child) => sameName(child.element, name));

    if (!root || !isTemplate) return [];

    return [
      root.view.element,
      ...root.view.children
        .filter(({ accepts }) => accepts?.elements?.some((item) => sameName(item, name)))
        .map(({ element }) => element)
    ];
  });

  return parents.length ? parents : null;
};

export { createRootFinder, getTemplateParents, matchElementView };
export type { ElementRoot, ElementViewMatch, ElementViewSource, RootFinder };
