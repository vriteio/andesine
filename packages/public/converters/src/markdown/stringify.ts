import type { Delete } from "mdast";
import type { Options } from "remark-stringify";

type StringifyHandler = NonNullable<NonNullable<Options["handlers"]>["delete"]> & {
  peek?: () => string;
};

const encodeCharacterReference = (character: string): string => {
  return `&#x${character.codePointAt(0)!.toString(16)};`;
};
const needsBoundaryEncoding = (outside: string, inside: string): boolean => {
  return Boolean(outside) && !/[\s\p{P}\p{S}]/u.test(outside) && /[\p{P}\p{S}]/u.test(inside);
};
const stringifyStrikethrough: StringifyHandler = (node: Delete, _parent, state, info) => {
  const tracker = state.createTracker(info);
  const exit = state.enter("strikethrough" as Parameters<typeof state.enter>[0]);
  const before = tracker.move("~~");
  // As with bold and italic, encode edge whitespace so delimiters can open and close.
  const content = state
    .containerPhrasing(node, {
      ...tracker.current(),
      before,
      after: "~"
    })
    .replace(/^\s|\s$/gu, encodeCharacterReference);

  exit();

  // Nested marks start/end with punctuation. Encode adjoining letters so the
  // tilde runs still open and close when formatting changes within a word.
  state.attentionEncodeSurroundingInfo = {
    before: needsBoundaryEncoding(info.before.slice(-1), content.slice(0, 1)),
    after: needsBoundaryEncoding(info.after.slice(0, 1), content.slice(-1))
  };

  return `~~${content}~~`;
};

stringifyStrikethrough.peek = () => "~";

const markdownStringifyHandlers: NonNullable<Options["handlers"]> = {
  delete: stringifyStrikethrough,
  text(node, _parent, state, info) {
    const value = state.safe(node.value, info);

    // Autolinks treat character references as literal parts of the URL.
    if (state.stack.includes("autolink")) return value;

    // The serializer's boundary escaping uses UTF-16 code units. Encode whole
    // supplementary characters at text edges before it can split a surrogate pair.
    return value.replace(
      /^[\u{10000}-\u{10FFFF}]|[\u{10000}-\u{10FFFF}]$/gu,
      encodeCharacterReference
    );
  }
};
const markdownStringifyOptions: Options = {
  bullet: "-",
  emphasis: "_",
  fences: true,
  handlers: markdownStringifyHandlers
};

export { markdownStringifyOptions };
