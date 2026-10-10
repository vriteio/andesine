import {
  EXTENSION_SLOT_SELECTOR,
  ExtensionStyleError,
  type ExtensionStyleKind,
  getExtensionScope,
  isSafeCSSValue,
  isScopedSelectorList,
  validateExtensionCSS
} from "@andesine/contracts/extensions";

const fail = (message: string): never => {
  throw new ExtensionStyleError(message);
};
const isConditionRule = (rule: CSSRule): rule is CSSMediaRule | CSSSupportsRule => {
  return rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule;
};
/** `prefix` is null at the top level of view CSS, where only its `@scope` rule is allowed. */
const validateRules = (rules: CSSRuleList, prefix: string | null, name: string): void => {
  for (const rule of Array.from(rules)) {
    const isViewScope =
      prefix === null &&
      typeof CSSScopeRule !== "undefined" &&
      rule instanceof CSSScopeRule &&
      rule.start === getExtensionScope(name) &&
      rule.end === EXTENSION_SLOT_SELECTOR;

    if (isViewScope) {
      validateRules((rule as CSSScopeRule).cssRules, ":scope", name);
    } else if (prefix !== null && rule instanceof CSSStyleRule) {
      const isNested = (rule.cssRules?.length ?? 0) > 0;

      if (isNested || !isScopedSelectorList(rule.selectorText, prefix)) {
        fail(`CSS rule outside the extension scope: ${rule.selectorText}`);
      }

      for (let index = 0; index < rule.style.length; index += 1) {
        const property = rule.style.item(index);

        if (!isSafeCSSValue(rule.style.getPropertyValue(property))) {
          fail(`Unsafe CSS value: ${property}`);
        }
      }
    } else if (prefix !== null && isConditionRule(rule)) {
      if (!isSafeCSSValue(rule.conditionText)) fail("Unsafe CSS condition");

      validateRules(rule.cssRules, prefix, name);
    } else {
      fail("CSS rule not allowed");
    }
  }
};
/**
 * Validates CSS as text, then the browser-parsed rules; adopt the returned sheet, do not re-parse.
 * Browsers without `@scope` drop view CSS, so it never applies unscoped.
 */
const createExtensionStyleSheet = (
  css: string,
  name: string,
  kind: ExtensionStyleKind = "view"
): CSSStyleSheet => {
  const sheet = new CSSStyleSheet();

  validateExtensionCSS(css, name, kind);
  sheet.replaceSync(css);
  validateRules(sheet.cssRules, kind === "view" ? null : getExtensionScope(name, kind), name);

  return sheet;
};

export { createExtensionStyleSheet };
