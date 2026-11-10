import { presentableDiff } from "@codemirror/merge";
import type { JSONContent } from "@tiptap/core";
import {
  createContentMerge,
  type VersionDiffContent,
  type VersionDiffContentMerge
} from "./inline";

const appendText = (targets: VersionDiffContent[][], text: string, diff?: "added" | "removed") => {
  if (!text) return;

  for (const target of targets) target.push({ type: "text", text, diff });
};
const mergeCodeContent = (
  previousContent: JSONContent[] = [],
  currentContent: JSONContent[] = []
): VersionDiffContentMerge => {
  const previous = previousContent.map((node) => node.text || "").join("");
  const current = currentContent.map((node) => node.text || "").join("");
  const result = createContentMerge();
  const changes = presentableDiff(previous, current, { scanLimit: 500 });

  let position = 0;

  for (const change of changes) {
    appendText(
      [result.previous, result.current, result.inline],
      current.slice(position, change.fromB)
    );
    appendText(
      [result.previous, result.inline],
      previous.slice(change.fromA, change.toA),
      "removed"
    );
    appendText([result.current, result.inline], current.slice(change.fromB, change.toB), "added");
    position = change.toB;
  }
  appendText([result.previous, result.current, result.inline], current.slice(position));
  return result;
};

export { mergeCodeContent };
