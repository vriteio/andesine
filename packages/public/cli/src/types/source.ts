import { createHash } from "node:crypto";

interface NamedItem {
  key: string;
  label: string;
}

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const json = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const literal = (value: string | null): string => json(value);
const union = (values: string[]): string =>
  [...new Set(values)].sort(compare).join(" | ") || "never";
const tuple = (values: string[]): string => `[${values.join(", ")}]`;
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const identifier = (label: string): string => {
  const words = label.normalize("NFKC").match(/[\p{L}\p{N}\p{M}]+/gu) ?? [];
  const name = words
    .map((word) => {
      const [first, ...rest] = Array.from(word);

      return first.toUpperCase() + rest.join("");
    })
    .join("")
    .replace(/[^\p{ID_Continue}]/gu, "");

  return /^[\p{ID_Start}]/u.test(name) ? name : `_${name || "Unnamed"}`;
};

/** Allocate stable identifiers without using remote text as TypeScript syntax. */
const names = (items: NamedItem[], suffix: string): Map<string, string> => {
  const counts = new Map<string, number>();
  const result = new Map<string, string>();
  const used = new Set<string>();
  const sorted = [...items].sort((a, b) => compare(a.key, b.key));

  for (const item of sorted) {
    const base = `${identifier(item.label)}${suffix}`;

    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

  for (const item of sorted) {
    const base = `${identifier(item.label)}${suffix}`;
    const digest = hash(item.key);

    let name = counts.get(base) === 1 ? base : `${base}_${digest.slice(0, 8)}`;
    let length = 8;

    while (used.has(name)) {
      length += 4;
      name = `${base}_${digest.slice(0, length)}`;
    }

    used.add(name);
    result.set(item.key, name);
  }

  return result;
};

export { compare, json, literal, union, tuple, hash, names };
