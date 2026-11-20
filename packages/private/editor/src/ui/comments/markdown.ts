import type { JSONContent } from "@tiptap/core";
import { validateURL } from "@andesine/document/tiptap";

interface CommentMark {
  type: string;
  attrs?: Record<string, unknown>;
}

const DELIMITERS = { bold: "**", italic: "_", strike: "~~" } as const;
const ESCAPED = /[\\*_~`[\]]/g;

type DelimitedMark = keyof typeof DELIMITERS;

const isWordCharacter = (character: string | undefined) => /\w/.test(character ?? "");
const getHref = (node: JSONContent) => {
  return node.marks?.find(({ type }) => type === "link")?.attrs?.href as string | undefined;
};
const serializeText = (node: JSONContent): string => {
  if (node.type === "hardBreak") return "\n";

  const marks = new Set(node.marks?.map(({ type }) => type));
  const href = getHref(node);

  let text = marks.has("code") ? `\`${node.text}\`` : (node.text ?? "").replace(ESCAPED, "\\$&");

  for (const mark of Object.keys(DELIMITERS) as DelimitedMark[]) {
    if (marks.has(mark)) text = `${DELIMITERS[mark]}${text}${DELIMITERS[mark]}`;
  }

  return href ? `[${text}](${href})` : text;
};
const serializeComment = (document: JSONContent): string => {
  return (document.content ?? [])
    .map((paragraph) => (paragraph.content ?? []).map(serializeText).join(""))
    .join("\n")
    .trim();
};
/** `_` must start or end a word, so snake_case stays text. */
const parseComment = (source: string): JSONContent => {
  const content: JSONContent[] = [];
  const marks = new Set<DelimitedMark>();

  let text = "";
  let index = 0;

  // In a fixed order, so the same text always gets the same marks.
  const markList = (extra: CommentMark[] = []): CommentMark[] => {
    const delimited = (Object.keys(DELIMITERS) as DelimitedMark[]).filter((mark) => {
      return marks.has(mark);
    });

    return [...delimited.map((type) => ({ type })), ...extra];
  };
  const flush = (extra: CommentMark[] = []) => {
    if (!text) return;

    content.push({ type: "text", text, marks: markList(extra) });
    text = "";
  };
  const toggle = (mark: DelimitedMark) => {
    flush();

    if (marks.has(mark)) marks.delete(mark);
    else marks.add(mark);
  };

  while (index < source.length) {
    const character = source[index];
    const rest = source.slice(index);
    const link = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
    const href = link && validateURL(link[2]);
    const code = /^`([^`]+)`/.exec(rest);
    const opensItalic = !marks.has("italic") && !isWordCharacter(source[index - 1]);
    const closesItalic = marks.has("italic") && !isWordCharacter(source[index + 1]);

    if (character === "\\" && index + 1 < source.length) {
      text += source[index + 1];
      index += 2;
    } else if (character === "\n") {
      flush();
      content.push({ type: "hardBreak" });
      index += 1;
    } else if (code) {
      flush();
      text = code[1];
      flush([{ type: "code" }]);
      index += code[0].length;
    } else if (link && href) {
      flush();

      for (const node of parseComment(link[1]).content?.[0]?.content ?? []) {
        content.push({
          ...node,
          marks: [...(node.marks ?? []), ...markList([{ type: "link", attrs: { href } }])]
        });
      }

      index += link[0].length;
    } else if (rest.startsWith("**") || rest.startsWith("~~")) {
      toggle(rest.startsWith("**") ? "bold" : "strike");
      index += 2;
    } else if (character === "_" && (opensItalic || closesItalic)) {
      toggle("italic");
      index += 1;
    } else {
      text += character;
      index += 1;
    }
  }

  flush();

  return { type: "doc", content: [{ type: "paragraph", content }] };
};

export { parseComment, serializeComment };
