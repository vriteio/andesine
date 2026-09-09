import { mergeAttributes, Node } from "@tiptap/core";

interface ImageAttributes {
  assetID: string | null;
  alt: string;
  caption: string;
  aspectRatio: number | null;
  size: number | null;
}
const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: false,
  addAttributes() {
    return {
      assetID: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attrs) => ({ "data-asset-id": attrs.assetID })
      },
      aspectRatio: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute("data-aspect-ratio")) || null,
        renderHTML: (attrs) => ({ "data-aspect-ratio": attrs.aspectRatio })
      },
      size: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute("data-size")) || null,
        renderHTML: (attrs) => ({ "data-size": attrs.size })
      },
      alt: { default: "" },
      caption: { default: "" }
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="image"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-type": "image" })];
  }
});

export { Image };
export type { ImageAttributes };
