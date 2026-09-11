import type { ElementEditorPresence } from "../../../lib/element-awareness";
import { createCaret, getCollaborationColor } from "../../../extensions/collaboration-caret";

const renderElementTag = (source: string, remote: ElementEditorPresence | null): HTMLElement[] => {
  const text = source.replace(/\r\n?/g, "\n");
  const selection = remote?.source === undefined ? undefined : remote.selection;
  const validSelection =
    selection &&
    selection.anchor >= 0 &&
    selection.head >= 0 &&
    selection.anchor <= text.length &&
    selection.head <= text.length;
  const from = validSelection ? Math.min(selection.anchor, selection.head) : -1;
  const to = validSelection ? Math.max(selection.anchor, selection.head) : -1;
  const head = validSelection ? selection.head : -1;
  const color = getCollaborationColor(remote?.color);

  let offset = 0;

  return text.split("\n").map((value) => {
    const line = document.createElement("div");
    const end = offset + value.length;
    const boundaries = [...new Set([offset, end, from, to, head])]
      .filter((position) => position >= offset && position <= end)
      .sort((a, b) => a - b);

    line.className = "element-tag-line";
    for (let index = 0; index < boundaries.length; index += 1) {
      const start = boundaries[index];
      const next = boundaries[index + 1];

      if (start === head && remote) {
        line.append(createCaret({ name: remote.name, color }, remote.clientID));
      }
      if (next === undefined) continue;

      const part = document.createElement("span");

      part.textContent = value.slice(start - offset, next - offset);
      if (start >= from && next <= to) {
        part.className = "collaboration-selection";
        part.style.setProperty("--collaboration-color", color);
      }
      line.append(part);
    }
    offset = end + 1;
    return line;
  });
};

export { renderElementTag };
