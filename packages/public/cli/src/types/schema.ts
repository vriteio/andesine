import type { SchemaField, SchemaProperty, SchemaRevision } from "@andesine/sdk";
import { compare, literal, union } from "./source";

/** Match the API's derived field keys, including Unicode and empty-label fallbacks. */
const fieldKey = (field: SchemaField): string => {
  const fallback = field.kind === "fragment" ? "content" : "property";
  const source = Array.from(field.label.normalize("NFC").trim()).slice(0, 50).join("");
  const words = (source || fallback)
    .normalize("NFKC")
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .match(/[\p{L}\p{N}\p{M}]+/gu);

  return (
    words
      ?.map((word, index) => {
        const [first = "", ...rest] = Array.from(word.toLowerCase());

        return `${index ? first.toUpperCase() : first}${rest.join("")}`;
      })
      .join("") || fallback
  );
};
const propertyValue = (field: SchemaProperty): string => {
  switch (field.type) {
    case "checkbox":
      return "boolean";
    case "number":
      return "number | null";
    case "select":
      return union([literal(""), ...field.options.map(literal)]);
    case "multi-select":
      return `Array<${union(field.options.map(literal))}>`;
    case "text":
    case "date":
    case "url":
      return "string";
    default:
      throw new Error(`Unsupported schema property type: ${String(field.type)}`);
  }
};
const fieldMap = (fields: Map<string, string>): string => {
  const sorted = [...fields].sort(([a], [b]) => compare(a, b));

  return sorted.length
    ? `{\n${sorted.map(([key, value]) => `    ${literal(key)}: ${value};`).join("\n")}\n  }`
    : "Record<never, never>";
};

/** Render effective fields only. Defaults are content, not constraints on field values. */
const schemaFields = (revision: SchemaRevision): string => {
  const groups = { property: new Map<string, string>(), fragment: new Map<string, string>() };

  if (revision.definition.formatVersion !== 1)
    throw new Error("Unsupported schema format version.");

  for (const field of revision.definition.fields) {
    const key = fieldKey(field);
    const group = groups[field.kind];

    if (group.has(key)) throw new Error(`Duplicate ${field.kind} key ${literal(key)}.`);

    group.set(
      key,
      field.kind === "property"
        ? `{ name: string; type: ${literal(field.type)}; value: ${propertyValue(field)} }`
        : `{ name: string; content: FragmentDocument<${union(field.allowedBlocks.map(literal))}> }`
    );
  }

  return `  properties: ${fieldMap(groups.property)};\n  fragments: ${fieldMap(groups.fragment)};`;
};

// Only block kinds are constrained by schemas. Element names, props, marks, and
// attributes remain general; default content must never become a schema for them.
const fragmentTypes = `type FragmentNode<Block extends string> = Omit<SDK.ContentNode, "type" | "content"> & {
  type: Block | "paragraph" | "listItem" | "taskItem" | "tableRow" | "tableCell" | "tableHeader" | "text" | "hardBreak";
  content?: Array<FragmentNode<Block>>;
};

type FragmentDocument<Block extends string> = Omit<SDK.ContentNode, "type" | "content"> & {
  type: "doc";
  content: Array<Omit<FragmentNode<Block>, "type"> & { type: Block | "paragraph" }>;
};`;

export { schemaFields, fragmentTypes };
