import { ELEMENT_BLOCKS, normalizeElementAttributes } from "../../element";
import { Node, mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";

const Element = Node.create({
  name: "element",
  group: "block",
  content: `(${ELEMENT_BLOCKS.join(" | ")})*`,
  defining: true,
  isolating: true,
  selectable: true,
  addAttributes() {
    return {
      name: { default: "Element", rendered: false },
      props: { default: {}, rendered: false },
      selfClosing: { default: true, rendered: false },
      source: { default: "<Element />", rendered: false }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="element"]',
        contentElement: "[data-element-content]",
        getAttrs: (dom) => {
          try {
            return normalizeElementAttributes(JSON.parse(dom.getAttribute("data-element") || "{}"));
          } catch {
            return false;
          }
        }
      }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = normalizeElementAttributes(node.attrs);

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "element",
        "data-element": JSON.stringify(attrs)
      }),
      ["span", { "data-element-tag": "opening" }, attrs.source],
      ["div", { "data-element-content": "" }, 0],
      ...(!node.attrs.selfClosing
        ? [["span", { "data-element-tag": "closing" }, `</${node.attrs.name}>`]]
        : [])
    ] as DOMOutputSpec;
  }
});

export { Element };
