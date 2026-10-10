import {
  extensionComponentDefinitions,
  extensionProtocolLimits,
  type ExtensionComponentDefinition,
  type ExtensionPatch
} from "@andesine/contracts/extensions";
import { createStore, produce } from "solid-js/store";

interface ExtensionTreeNode {
  id: number;
  /** `#root`, `#text`, or a host component name. */
  component: string;
  text: string;
  props: Record<string, unknown>;
  callbacks: Record<string, number>;
  children: number[];
  parent: number | null;
}
interface ExtensionTreeState {
  nodes: Record<number, ExtensionTreeNode>;
  roots: Record<string, number>;
  /** Views whose root broke their restriction; the rest of the tree stays valid. */
  invalidViews: Record<string, true>;
}
interface ExtensionTree {
  state: ExtensionTreeState;
  /** Applies one patch message; throws `ExtensionTreeError` on any invalid patch. */
  apply(patches: ExtensionPatch[]): void;
  /** Allows at most one node, of `components`, at the view's root; others mark it invalid. */
  restrictRoot(viewID: string, components: string[]): void;
}

const definitions: Record<string, ExtensionComponentDefinition> = extensionComponentDefinitions;

class ExtensionTreeError extends Error {}

const check: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new ExtensionTreeError(message);
};
const getDefinition = (node: ExtensionTreeNode): ExtensionComponentDefinition => {
  const definition = Object.hasOwn(definitions, node.component)
    ? definitions[node.component]
    : undefined;

  check(definition, "Props are only allowed on host components");

  return definition;
};
/** The host tree mirrors the worker's serialized tree; it holds only validated data. */
const createExtensionTree = (): ExtensionTree => {
  const [state, setState] = createStore<ExtensionTreeState>({
    nodes: {},
    roots: {},
    invalidViews: {}
  });
  const rootRestrictions = new Map<string, string[]>();

  let count = 0;

  const getNode = (draft: ExtensionTreeState, id: number): ExtensionTreeNode => {
    const node = draft.nodes[id];

    check(node, "Unknown node");

    return node;
  };
  const addNode = (draft: ExtensionTreeState, id: number, component: string, text = ""): void => {
    check(!draft.nodes[id], "Duplicate node");
    check(count < extensionProtocolLimits.nodes, "Too many nodes");
    draft.nodes[id] = { id, component, text, props: {}, callbacks: {}, children: [], parent: null };
    count += 1;
  };
  const detach = (draft: ExtensionTreeState, node: ExtensionTreeNode): void => {
    if (node.parent === null) return;

    const siblings = getNode(draft, node.parent).children;

    siblings.splice(siblings.indexOf(node.id), 1);
    node.parent = null;
  };
  const removeSubtree = (draft: ExtensionTreeState, node: ExtensionTreeNode): void => {
    node.children.forEach((child) => removeSubtree(draft, getNode(draft, child)));
    delete draft.nodes[node.id];
    count -= 1;
  };
  const isAncestor = (draft: ExtensionTreeState, ancestor: number, id: number | null): boolean => {
    for (let current = id; current !== null; current = getNode(draft, current).parent) {
      if (current === ancestor) return true;
    }

    return false;
  };
  const applyPatch = (draft: ExtensionTreeState, patch: ExtensionPatch): void => {
    if (patch.op === "root") {
      check(!Object.hasOwn(draft.roots, patch.viewID), "Duplicate view root");
      addNode(draft, patch.id, "#root");
      draft.roots[patch.viewID] = patch.id;
    } else if (patch.op === "create") {
      check(Object.hasOwn(definitions, patch.component), `Unknown component: ${patch.component}`);
      addNode(draft, patch.id, patch.component);
    } else if (patch.op === "text") {
      addNode(draft, patch.id, "#text", patch.value);
    } else if (patch.op === "setText") {
      const node = getNode(draft, patch.id);

      check(node.component === "#text", "Not a text node");
      node.text = patch.value;
    } else if (patch.op === "insert") {
      const parent = getNode(draft, patch.parent);
      const node = getNode(draft, patch.id);
      const acceptsChildren = parent.component === "#root" || getDefinition(parent).children;
      const allowedParents = Object.hasOwn(definitions, node.component)
        ? definitions[node.component].parents
        : undefined;
      const isValidChild =
        node.component !== "#root" &&
        (!allowedParents || allowedParents.includes(parent.component)) &&
        !isAncestor(draft, node.id, parent.id);

      check(acceptsChildren && isValidChild, "Invalid insert");

      const viewID =
        parent.component === "#root"
          ? Object.keys(draft.roots).find((key) => draft.roots[key] === parent.id)
          : undefined;
      const allowedRoots = viewID === undefined ? undefined : rootRestrictions.get(viewID);
      const breaksRestriction =
        allowedRoots &&
        (draft.invalidViews[viewID!] ||
          !allowedRoots.includes(node.component) ||
          parent.children.some((child) => child !== node.id));

      // Fails only that view, which its host handles; the node stays detached.
      if (breaksRestriction) {
        draft.invalidViews[viewID!] = true;

        return;
      }

      detach(draft, node);

      const index =
        patch.before === null ? parent.children.length : parent.children.indexOf(patch.before);

      check(index >= 0, "Unknown sibling");
      parent.children.splice(index, 0, node.id);
      node.parent = parent.id;
    } else if (patch.op === "remove") {
      const node = getNode(draft, patch.id);
      const viewID = Object.keys(draft.roots).find((key) => draft.roots[key] === node.id);

      detach(draft, node);
      removeSubtree(draft, node);

      if (viewID !== undefined) {
        delete draft.roots[viewID];
        delete draft.invalidViews[viewID];
        rootRestrictions.delete(viewID);
      }
    } else if (patch.op === "prop") {
      const node = getNode(draft, patch.id);
      const shape = getDefinition(node).props.shape;

      check(Object.hasOwn(shape, patch.name), `Unknown prop: ${patch.name}`);
      check(shape[patch.name].safeParse(patch.value).success, `Invalid prop: ${patch.name}`);
      node.props[patch.name] = patch.value;
    } else if (patch.op === "callback") {
      const node = getNode(draft, patch.id);

      check(Object.hasOwn(getDefinition(node).events, patch.name), `Unknown event: ${patch.name}`);
      node.callbacks[patch.name] = patch.callback;
    } else {
      const node = getNode(draft, patch.id);
      const definition = getDefinition(node);
      const isKnown =
        Object.hasOwn(definition.props.shape, patch.name) ||
        Object.hasOwn(definition.events, patch.name);

      check(isKnown, `Unknown prop: ${patch.name}`);
      delete node.props[patch.name];
      delete node.callbacks[patch.name];
    }
  };
  const apply = (patches: ExtensionPatch[]): void => {
    setState(
      produce((draft) => {
        for (const patch of patches) applyPatch(draft, patch);
      })
    );
  };

  return {
    state,
    apply,
    restrictRoot(viewID, components) {
      rootRestrictions.set(viewID, components);
    }
  };
};

export { createExtensionTree, ExtensionTreeError };
export type { ExtensionTree, ExtensionTreeNode, ExtensionTreeState };
