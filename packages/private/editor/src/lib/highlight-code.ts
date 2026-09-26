import { highlightCode as highlightTree, tagHighlighter, tags as t } from "@lezer/highlight";
import { findCodeLanguage } from "./code-languages";

interface CodeToken {
  kind: string;
  text: string;
}

const tokenHighlighter = tagHighlighter([
  { tag: [t.standard(t.tagName), t.tagName], class: "tag" },
  { tag: [t.className, t.propertyName], class: "property" },
  { tag: [t.variableName, t.attributeName, t.number, t.operator], class: "value" },
  { tag: [t.string, t.url, t.escape, t.regexp], class: "string" },
  { tag: [t.atom, t.bool, t.null, t.special(t.variableName)], class: "literal" },
  { tag: [t.comment, t.punctuation], class: "punctuation" }
]);

// Tokenizes code without an editor view; line breaks become "\n" tokens.
const highlightCode = async (source: string, languageName: string): Promise<CodeToken[]> => {
  const description = findCodeLanguage(languageName);
  const tokens: CodeToken[] = [];

  if (!description) return [{ kind: "", text: source }];

  const support = description.support || (await description.load());

  highlightTree(
    source,
    support.language.parser.parse(source),
    tokenHighlighter,
    (text, kind) => tokens.push({ kind, text }),
    () => tokens.push({ kind: "", text: "\n" })
  );

  return tokens;
};

export { highlightCode };
export type { CodeToken };
