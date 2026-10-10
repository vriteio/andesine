import { createRenderer } from "solid-js/universal";
import type { JSONValue, ViewPatch } from "./protocol";

/** A node of the serialized view tree; it mirrors the host tree, which has the real DOM. */
interface ViewNode {
  id: number;
  type: string;
  parent?: ViewNode;
  children: ViewNode[];
  callbacks: Map<string, number>;
}

type PatchSender = (patches: ViewPatch[]) => void;

const MAX_PATCHES_PER_MESSAGE = 1000;
const MAX_JSON_DEPTH = 8;
const callbacks = new Map<number, (...args: unknown[]) => unknown>();
// Solid moves nodes by removal and insertion; removals wait for the flush to skip reinserted nodes.
const removedNodes = new Set<ViewNode>();

let nextID = 1;
let queue: ViewPatch[] = [];
let flushScheduled = false;
let sendPatches: PatchSender = () => {};

const releaseCallbacks = (node: ViewNode): void => {
  for (const callback of node.callbacks.values()) callbacks.delete(callback);

  node.callbacks.clear();
  node.children.forEach(releaseCallbacks);
};
const flush = (): void => {
  for (const node of removedNodes) {
    if (node.parent) continue;

    releaseCallbacks(node);
    queue.push({ op: "remove", id: node.id });
  }

  removedNodes.clear();

  const patches = queue;

  flushScheduled = false;
  queue = [];

  for (let index = 0; index < patches.length; index += MAX_PATCHES_PER_MESSAGE) {
    sendPatches(patches.slice(index, index + MAX_PATCHES_PER_MESSAGE));
  }
};
const scheduleFlush = (): void => {
  if (flushScheduled) return;

  flushScheduled = true;
  queueMicrotask(flush);
};
const queuePatch = (patch: ViewPatch): void => {
  queue.push(patch);
  scheduleFlush();
};
const createNode = (type: string): ViewNode => {
  return { id: nextID++, type, children: [], callbacks: new Map() };
};
const toJSONValue = (value: unknown, depth = 0): JSONValue => {
  const isPrimitive =
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value));

  if (isPrimitive) return value as JSONValue;

  if (depth >= MAX_JSON_DEPTH) throw new TypeError("Extension props are nested too deeply");

  if (Array.isArray(value)) return value.map((item) => toJSONValue(item, depth + 1));

  if (Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as object).map(([key, item]) => [key, toJSONValue(item, depth + 1)])
    );
  }

  throw new TypeError("Extension props must be JSON values or functions");
};
const detach = (node: ViewNode): void => {
  const siblings = node.parent?.children;

  if (siblings) siblings.splice(siblings.indexOf(node), 1);

  node.parent = undefined;
};
const renderer = createRenderer<ViewNode>({
  createElement(type) {
    const node = createNode(type);

    queuePatch({ op: "create", id: node.id, component: type });

    return node;
  },
  // Solid passes numbers from JSX expressions as they are; the protocol carries strings.
  createTextNode(value) {
    const node = createNode("#text");

    queuePatch({ op: "text", id: node.id, value: String(value) });

    return node;
  },
  replaceText(node, value) {
    queuePatch({ op: "setText", id: node.id, value: String(value) });
  },
  isTextNode(node) {
    return node.type === "#text";
  },
  setProperty(node, name, value) {
    const previous = node.callbacks.get(name);

    if (previous) {
      callbacks.delete(previous);
      node.callbacks.delete(name);
    }

    if (typeof value === "function") {
      const callback = nextID++;

      callbacks.set(callback, value as (...args: unknown[]) => unknown);
      node.callbacks.set(name, callback);
      queuePatch({ op: "callback", id: node.id, name, callback });
    } else if (value === undefined) {
      queuePatch({ op: "unset", id: node.id, name });
    } else {
      queuePatch({ op: "prop", id: node.id, name, value: toJSONValue(value) });
    }
  },
  insertNode(parent, node, anchor) {
    const index = anchor ? parent.children.indexOf(anchor) : -1;

    detach(node);
    node.parent = parent;

    if (index >= 0) {
      parent.children.splice(index, 0, node);
    } else {
      parent.children.push(node);
    }

    queuePatch({ op: "insert", parent: parent.id, id: node.id, before: anchor?.id ?? null });
  },
  removeNode(_parent, node) {
    detach(node);
    removedNodes.add(node);
    scheduleFlush();
  },
  getParentNode(node) {
    return node.parent;
  },
  getFirstChild(node) {
    return node.children[0];
  },
  getNextSibling(node) {
    const siblings = node.parent?.children;

    return siblings?.[siblings.indexOf(node) + 1];
  }
});
const createViewRoot = (viewID: string): ViewNode => {
  const node = createNode("#root");

  queuePatch({ op: "root", id: node.id, viewID });

  return node;
};
const removeViewRoot = (node: ViewNode): void => {
  releaseCallbacks(node);
  queuePatch({ op: "remove", id: node.id });
};
const setPatchSender = (sender: PatchSender): void => {
  sendPatches = sender;
};
const getCallback = (callback: number): ((...args: unknown[]) => unknown) | undefined => {
  return callbacks.get(callback);
};

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
  use
} = renderer;
export { createViewRoot, removeViewRoot, setPatchSender, getCallback };
export type { ViewNode };
