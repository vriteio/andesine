type MarkupValue = Markup | string | number | boolean | null | undefined | MarkupValue[];

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Card markup from the `html` template tag, whose values are already escaped. */
class Markup {
  constructor(readonly value: string) {}

  toString(): string {
    return this.value;
  }
}

const toMarkup = (value: MarkupValue): string => {
  const isEmpty = value === null || value === undefined || typeof value === "boolean";

  if (value instanceof Markup) return value.value;
  if (Array.isArray(value)) return value.map(toMarkup).join("");
  if (isEmpty) return "";

  return String(value).replace(/[&<>"]/g, (character) => entities[character]!);
};
/**
 * A template tag for social card markup. It escapes values, joins arrays, and leaves out
 * `false`, `null`, and `undefined`, so `${condition && html`…`}` adds optional parts.
 */
const html = (strings: TemplateStringsArray, ...values: MarkupValue[]): Markup => {
  return new Markup(
    strings.reduce((result, part, index) => {
      return result + part + (index < values.length ? toMarkup(values[index]!) : "");
    }, "")
  );
};

export { html, Markup };
export type { MarkupValue };
