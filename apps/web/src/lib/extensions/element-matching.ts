import {
  type ExtensionActiveView,
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
  entry: string;
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
/** Prefers the nearest root view's descendant view, then the element's own root view. */
const matchElementView = <T>(
  findRoot: RootFinder<T>,
  name: string,
  ancestors: string[]
): ElementViewMatch<T> | null => {
  for (const ancestor of ancestors) {
    const root = findRoot(ancestor);

    if (!root) continue;

    const descendant = root.view.descendants.find(({ element }) => sameName(element, name));

    if (descendant) return { extension: root.extension, entry: descendant.entry };

    break;
  }

  const own = findRoot(name);

  return own ? { extension: own.extension, entry: own.view.entry } : null;
};

export { createRootFinder, matchElementView };
export type { ElementRoot, ElementViewMatch, ElementViewSource, RootFinder };
