import type { Element, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import { prepareMarkdown, type HighlightOptions } from "../../content/prepare";
import { toFacts, toTypeLabel, type Fact } from "./labels";
import {
  resolveSchema,
  resolveSchemaDetails,
  getRequiredNames,
  type ApiMediaType,
  type ApiModel,
  type ApiSchema
} from "./model";

interface MediaView {
  id: string;
  type: string;
  schema?: FieldView;
}

interface FieldView {
  id: string;
  name: string;
  type: string;
  required: boolean;
  deprecated: boolean;
  readOnly: boolean;
  writeOnly: boolean;
  /** HTML. */
  description?: string;
  facts: Fact[];
  /** Nested fields of objects, and of the items of arrays. */
  fields: FieldView[];
  /** Options of `oneOf` and `anyOf` schemas. */
  variants: VariantView[];
  /** Set when the field repeats a schema that contains it: a link to the first occurrence. */
  recursive?: { name: string; href: string };
}

interface VariantView {
  id: string;
  label: string;
  kind: "oneOf" | "anyOf";
  type: string;
  /** HTML. */
  description?: string;
  facts: Fact[];
  fields: FieldView[];
  variants: VariantView[];
}

interface Ancestor {
  ref: string;
  id: string;
}

interface Nested {
  fields: FieldView[];
  variants: VariantView[];
  recursive?: FieldView["recursive"];
}

const maxDepth = 12;
// Descriptions repeat across operations, e.g. in error responses.
const descriptions = new Map<string, Promise<string>>();

const toID = (value: string): string => value.replace(/[^\w-]+/g, "-");
/** Removes the IDs of headings, which could repeat the IDs of operation sections. */
const removeHeadingIDs = (node: Root | Element): Root | Element => {
  node.children.forEach((child) => {
    if (child.type !== "element") return;
    if (/^h[1-6]$/.test(child.tagName)) delete child.properties.id;

    removeHeadingIDs(child);
  });

  return node;
};
const toHTML = (markdown: string | undefined, highlight: HighlightOptions) => {
  if (!markdown) return undefined;

  if (!descriptions.has(markdown)) {
    descriptions.set(
      markdown,
      prepareMarkdown(markdown, highlight).then(({ nodes }) => toHtml(removeHeadingIDs(nodes)))
    );
  }

  return descriptions.get(markdown)!;
};
/** Merges fields that `allOf` parts repeat, e.g. a part that makes a base field read-only. */
const mergeFields = (fields: FieldView[]): FieldView[] => {
  const merged = new Map<string, FieldView>();

  fields.forEach((field) => {
    const previous = merged.get(field.name);

    if (!previous) {
      merged.set(field.name, field);

      return;
    }

    merged.set(field.name, {
      ...previous,
      type: field.type === "any" ? previous.type : field.type,
      required: previous.required || field.required,
      deprecated: previous.deprecated || field.deprecated,
      readOnly: previous.readOnly || field.readOnly,
      writeOnly: previous.writeOnly || field.writeOnly,
      description: field.description ?? previous.description,
      // Later parts replace facts with the same label, e.g. a default.
      facts: [
        ...new Map([...previous.facts, ...field.facts].map((fact) => [fact.label, fact])).values()
      ],
      fields: mergeFields([...previous.fields, ...field.fields]),
      variants: [...previous.variants, ...field.variants],
      recursive: previous.recursive ?? field.recursive
    });
  });

  return [...merged.values()];
};
/** Builds field trees of schemas. A field that repeats a schema that contains it links to it. */
const createFieldBuilder = (model: ApiModel, highlight: HighlightOptions) => {
  const expand = async (
    schema: ApiSchema,
    id: string,
    ancestors: Ancestor[],
    depth: number,
    required = new Set<string>()
  ): Promise<Nested> => {
    const ancestor = schema.ref && ancestors.find((item) => item.ref === schema.ref);

    if (ancestor) {
      return {
        fields: [],
        variants: [],
        recursive: { name: ancestor.ref, href: `#${ancestor.id}` }
      };
    }

    const target = resolveSchema(schema, model);
    const path = schema.ref ? [...ancestors, { ref: schema.ref, id }] : ancestors;
    const requiredNames = new Set([...required, ...getRequiredNames(schema, model)]);

    if (!target || depth > maxDepth) return { fields: [], variants: [] };

    const fields = await Promise.all(
      (target.properties ?? []).map((property) => {
        return toField(
          property.name,
          property.required || requiredNames.has(property.name),
          property.schema,
          `${id}-${toID(property.name)}`,
          path,
          depth
        );
      })
    );
    const variants: VariantView[] = [];

    if (typeof target.additionalProperties === "object") {
      fields.push(
        await toField("{key}", false, target.additionalProperties, `${id}-key`, path, depth)
      );
    }

    let recursive: Nested["recursive"];

    if (target.items) {
      const nested = await expand(target.items, id, path, depth);

      fields.push(...nested.fields);
      variants.push(...nested.variants);
      recursive = nested.recursive;
    }

    for (const part of target.allOf ?? []) {
      const nested = await expand(part, id, path, depth, requiredNames);

      fields.push(...nested.fields);
      variants.push(...nested.variants);
      recursive ??= nested.recursive;
    }

    for (const kind of ["oneOf", "anyOf"] as const) {
      const options = await Promise.all(
        (target[kind] ?? []).map(async (option, index): Promise<VariantView> => {
          const optionID = `${id}-${kind}-${index + 1}`;
          const nested = await expand(option, optionID, path, depth + 1, requiredNames);
          const optionTarget = resolveSchemaDetails(option, model);

          return {
            id: optionID,
            label: option.ref ?? option.title ?? `Option ${index + 1}`,
            kind,
            type: toTypeLabel(optionTarget ?? option),
            description: await toHTML(optionTarget?.description, highlight),
            facts: optionTarget ? toFacts(optionTarget) : [],
            fields: nested.fields,
            variants: nested.variants
          };
        })
      );

      variants.push(...options);
    }

    return { fields: mergeFields(fields), variants, recursive };
  };
  const toField = async (
    name: string,
    required: boolean,
    schema: ApiSchema,
    id: string,
    ancestors: Ancestor[],
    depth: number
  ): Promise<FieldView> => {
    const target = resolveSchemaDetails(schema, model);
    const nested = await expand(schema, id, ancestors, depth + 1);

    return {
      id,
      name,
      type: toTypeLabel(schema.ref ? schema : (target ?? schema)),
      required,
      deprecated: Boolean(target?.deprecated),
      readOnly: Boolean(target?.readOnly),
      writeOnly: Boolean(target?.writeOnly),
      description: await toHTML(target?.description, highlight),
      facts: target ? toFacts(target) : [],
      ...nested
    };
  };
  const toMedia = async (media: ApiMediaType, id: string): Promise<MediaView> => {
    const schema = media.schema
      ? await toField("Body", false, media.schema, `${id}-schema`, [], 0)
      : undefined;

    if (schema && media.schema) {
      schema.type = toTypeLabel(resolveSchemaDetails(media.schema, model) ?? media.schema);
    }

    return {
      id,
      type: media.type,
      schema
    };
  };

  return { toField, toMedia };
};

export { createFieldBuilder, toHTML, toID };
export type { MediaView, FieldView, VariantView };
