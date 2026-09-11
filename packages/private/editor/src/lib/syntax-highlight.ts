import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/*
 * GitHub Light syntax colors from uiwjs/react-codemirror/themes/github.
 * MIT License — Copyright (c) 2021 uiw
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const syntaxHighlightStyle = HighlightStyle.define([
  { tag: [t.standard(t.tagName), t.tagName], color: "var(--syntax-tag)" },
  { tag: [t.comment, t.bracket], color: "var(--syntax-punctuation)" },
  { tag: [t.className, t.propertyName], color: "var(--syntax-property)" },
  { tag: [t.variableName, t.attributeName, t.number, t.operator], color: "var(--syntax-value)" },
  { tag: [t.keyword, t.typeName, t.typeOperator], color: "#d73a49" },
  { tag: [t.string, t.meta, t.regexp], color: "var(--syntax-string)" },
  { tag: [t.name, t.quote], color: "#22863a" },
  { tag: [t.heading, t.strong], color: "#24292e", fontWeight: "bold" },
  { tag: t.emphasis, color: "#24292e", fontStyle: "italic" },
  { tag: t.deleted, color: "#b31d28", backgroundColor: "#ffeef0" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "var(--syntax-literal)" },
  { tag: [t.url, t.escape, t.regexp, t.link], color: "var(--syntax-string)" },
  { tag: t.link, textDecoration: "underline" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "#cb2431" }
]);

export { syntaxHighlightStyle };
