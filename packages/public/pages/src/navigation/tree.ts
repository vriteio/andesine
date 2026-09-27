import type { NavigationItem } from "../context";
import type { SourceNode, SourcePage } from "../sources";

/** Returns the nodes from the root to the node of the page, or an empty list. */
const findTrail = (nodes: SourceNode[], page: SourcePage): SourceNode[] => {
  for (const node of nodes) {
    if (node.page === page) return [node];

    const trail = node.children ? findTrail(node.children, page) : [];

    if (trail.length) return [node, ...trail];
  }

  return [];
};
/** Returns the nodes with a page, in reading order. */
const flattenTree = (nodes: SourceNode[]): SourceNode[] => {
  return nodes.flatMap((node) => {
    return [...(node.page ? [node] : []), ...(node.children ? flattenTree(node.children) : [])];
  });
};
const createNavigationItems = (nodes: SourceNode[], trail: SourceNode[]): NavigationItem[] => {
  return nodes.map((node) => {
    return {
      id: node.id,
      label: node.label,
      href: node.page?.href,
      current: node === trail.at(-1),
      active: trail.includes(node),
      children: node.children ? createNavigationItems(node.children, trail) : []
    };
  });
};

export { findTrail, flattenTree, createNavigationItems };
