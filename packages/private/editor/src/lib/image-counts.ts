import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const countImages = (document: ProseMirrorNode): Map<string, number> => {
  const counts = new Map<string, number>();

  document.descendants((node) => {
    if (node.type.name !== "image") return;
    const id = String(node.attrs.assetID || "");

    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
};
const changesImages = (before: ProseMirrorNode, after: ProseMirrorNode): boolean => {
  const previous = countImages(before);
  const next = countImages(after);

  return previous.size !== next.size || [...next].some(([id, count]) => previous.get(id) !== count);
};

export { countImages, changesImages };
