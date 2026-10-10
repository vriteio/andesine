type ExtensionStyleKind = "view" | "icon";

const MAX_EXTENSION_CSS_SIZE = 256 * 1024;
const ALLOWED_AT_RULES = new Set(["media", "supports"]);
// Inline SVG icons (`--un-icon`) are the only URLs: they load nothing.
const DATA_SVG_URL = /url\(\s*(?:"data:image\/svg\+xml[^"]*"|'data:image\/svg\+xml[^']*')\s*\)/gi;
const FORBIDDEN_VALUE =
  /url\(|\bsrc\(|\bimage\(|image-set\(|expression\(|-moz-binding|behavior\s*:|\\|@|[{}<]/i;
const NEWLINE = /[\n\r\f]/;

class ExtensionStyleError extends Error {}

/** Host-owned content slots inside element views; extension CSS stops at them. */
const EXTENSION_SLOT_SELECTOR = "[data-content-slot]";
/** Views render inside `data-extension`; manifest icons inside `data-extension-icon`. */
const getExtensionScope = (name: string, kind: ExtensionStyleKind = "view"): string => {
  return `[${kind === "view" ? "data-extension" : "data-extension-icon"}="${name}"]`;
};
/** The `@scope` prelude of view CSS: the view down to, but not into, its content slots. */
const getViewScopePrelude = (name: string): string => {
  return `(${getExtensionScope(name)}) to (${EXTENSION_SLOT_SELECTOR})`;
};
const fail = (message: string): never => {
  throw new ExtensionStyleError(message);
};
/** Strips comments, parsing like the browser so the validated text matches what applies. */
const stripComments = (css: string): string => {
  let result = "";
  let quote = "";

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];

    if (char === "\\") {
      result += css.slice(index, index + 2);
      index += 1;
    } else if (quote) {
      if (NEWLINE.test(char)) fail("Unterminated CSS string");

      if (char === quote) quote = "";

      result += char;
    } else if (char === "/" && css[index + 1] === "*") {
      const end = css.indexOf("*/", index + 2);

      if (end < 0) fail("Unterminated CSS comment");

      result += " ";
      index = end + 1;
    } else {
      if (char === '"' || char === "'") quote = char;

      result += char;
    }
  }

  return quote ? fail("Unterminated CSS string") : result;
};
/** Finds the next `stops` character outside strings, escapes, parentheses, and brackets, or -1. */
const scan = (css: string, start: number, stops: string): number => {
  let depth = 0;
  let quote = "";

  for (let index = start; index < css.length; index += 1) {
    const char = css[index];

    if (char === "\\") {
      index += 1;
    } else if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(" || char === "[") {
      depth += 1;
    } else if (char === ")" || char === "]") {
      depth -= 1;
    } else if (depth === 0 && stops.includes(char)) {
      return index;
    }
  }

  return -1;
};
const readUntil = (css: string, start: number, stops: string): number => {
  const index = scan(css, start, stops);

  return index < 0 ? fail("Unterminated CSS block") : index;
};
/** Finds the `}` that closes the block opened at `open`, counting nested blocks. */
const findBlockEnd = (css: string, open: number): number => {
  let depth = 1;
  let index = open;

  while (depth > 0) {
    index = readUntil(css, index + 1, "{}");
    depth += css[index] === "{" ? 1 : -1;
  }

  return index;
};
const splitSelectors = (prelude: string): string[] => {
  const selectors: string[] = [];

  let start = 0;

  for (let end = scan(prelude, 0, ","); end >= 0; end = scan(prelude, start, ",")) {
    selectors.push(prelude.slice(start, end).trim());
    start = end + 1;
  }

  selectors.push(prelude.slice(start).trim());

  return selectors;
};
/** Each selector descends from `prefix` (no bare prefix); sibling combinators escape the scope. */
const isScopedSelectorList = (selectors: string, prefix: string): boolean => {
  return splitSelectors(selectors).every((selector) => {
    const rest = selector.slice(prefix.length).trim();

    return selector.startsWith(`${prefix} `) && rest.length > 0 && !/^[~+]/.test(rest);
  });
};
/** Values load nothing (only inline SVG icon URLs) and contain no escapes or nested blocks. */
const isSafeCSSValue = (value: string): boolean => {
  return !FORBIDDEN_VALUE.test(value.replace(DATA_SVG_URL, ""));
};
/** `prefix` is null at the top level of view CSS, where only the `@scope` rule is allowed. */
const validateBlock = (
  css: string,
  start: number,
  end: number,
  prefix: string | null,
  scopePrelude: string
): void => {
  let index = start;

  while (index < end) {
    while (index < end && /\s/.test(css[index])) index += 1;

    if (index >= end) return;

    const open = readUntil(css, index, "{;");

    if (css[open] === ";") fail("CSS statements must be rules");

    const prelude = css.slice(index, open).trim();
    const close = findBlockEnd(css, open);

    if (scan(prelude, 0, "}") >= 0) fail("Unexpected CSS block end");

    if (close > end) fail("Unterminated CSS block");

    if (prelude.startsWith("@")) {
      const atRule = (/^@([\w-]+)/.exec(prelude)?.[1] ?? "").toLowerCase();
      const condition = prelude.slice(atRule.length + 1).trim();
      const isViewScope = atRule === "scope" && prefix === null && condition === scopePrelude;
      const isCondition = ALLOWED_AT_RULES.has(atRule) && prefix !== null;

      if (!isViewScope && !isCondition) fail(`CSS at-rule not allowed here: @${atRule}`);

      if (!isSafeCSSValue(condition)) fail("Unsafe CSS condition");

      validateBlock(css, open + 1, close, isViewScope ? ":scope" : prefix, scopePrelude);
    } else {
      if (prefix === null) fail("Extension view CSS must be inside its @scope rule");

      if (!isScopedSelectorList(prelude, prefix!)) {
        fail(`CSS selector outside the scope: ${prelude}`);
      }

      if (!isSafeCSSValue(css.slice(open + 1, close))) {
        fail("CSS values cannot load resources or use escapes");
      }
    }

    index = close + 1;
  }
};
/**
 * View CSS is one `@scope (<view>) to (<content slot>)` rule; icon CSS starts with the icon scope.
 * Inside, only style rules (or `@media`/`@supports`) with safe values; the host re-checks them.
 */
const validateExtensionCSS = (
  css: string,
  name: string,
  kind: ExtensionStyleKind = "view"
): void => {
  if (css.length > MAX_EXTENSION_CSS_SIZE) fail("Extension CSS is too large");

  const withoutComments = stripComments(css);
  const prefix = kind === "view" ? null : getExtensionScope(name, kind);

  validateBlock(withoutComments, 0, withoutComments.length, prefix, getViewScopePrelude(name));
};

export {
  MAX_EXTENSION_CSS_SIZE,
  EXTENSION_SLOT_SELECTOR,
  ExtensionStyleError,
  getExtensionScope,
  getViewScopePrelude,
  isScopedSelectorList,
  isSafeCSSValue,
  validateExtensionCSS
};
export type { ExtensionStyleKind };
