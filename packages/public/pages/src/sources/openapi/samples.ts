import { resolveSchema, type ApiModel, type ApiSchema } from "./model";
import { isObject } from "./normalize";

/** Requests leave out read-only fields; responses leave out write-only fields. */
type SampleMode = "request" | "response";

const maxDepth = 8;
const formatSamples: Record<string, string> = {
  "date-time": "2026-01-01T00:00:00Z",
  "date": "2026-01-01",
  "time": "00:00:00Z",
  "email": "user@example.com",
  "uri": "https://example.com",
  "url": "https://example.com",
  "hostname": "example.com",
  "uuid": "00000000-0000-0000-0000-000000000000",
  "ipv4": "192.0.2.1",
  "ipv6": "2001:db8::1",
  "byte": "U3RyaW5n",
  "binary": "<binary>"
};
const limitKeys = ["minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum"];

/**
 * A number within the limits: the lower limit, or 0 without one, up to the upper limit.
 * Integers round toward the inside of the limits.
 */
const toNumberSample = (constraints: Record<string, unknown> = {}, integer: boolean): number => {
  const [minimum, exclusiveMinimum, maximum, exclusiveMaximum] = limitKeys.map((key) => {
    const value = constraints[key];

    return typeof value === "number" ? value : undefined;
  });
  const lower = minimum ?? (exclusiveMinimum === undefined ? undefined : exclusiveMinimum + 1);
  const upper = maximum ?? (exclusiveMaximum === undefined ? undefined : exclusiveMaximum - 1);
  const isNarrow = lower !== undefined && upper !== undefined && lower > upper;
  const usesUpper = upper !== undefined && upper < (lower ?? 0);

  // Exclusive limits that are closer than 1, e.g. above 0 and below 0.5, contain their middle.
  if (isNarrow) {
    const middle = ((minimum ?? exclusiveMinimum)! + (maximum ?? exclusiveMaximum)!) / 2;

    return integer ? Math.ceil(middle) : middle;
  }

  if (usesUpper) return integer ? Math.floor(upper) : upper;

  return integer ? Math.ceil(lower ?? 0) : (lower ?? 0);
};
const toTypeSample = (schema: ApiSchema): unknown => {
  const type = schema.type?.find((item) => item !== "null") ?? schema.type?.[0];

  if (type === "string") return formatSamples[schema.format ?? ""] ?? "string";

  if (type === "integer" || type === "number") {
    return toNumberSample(schema.constraints, type === "integer");
  }

  if (type === "boolean") return true;
  if (type === "null") return null;

  return undefined;
};
const mergeSamples = (previous: unknown, next: unknown): unknown => {
  if (!isObject(previous) || !isObject(next)) return next === undefined ? previous : next;

  const names = new Set([...Object.keys(previous), ...Object.keys(next)]);

  return Object.fromEntries(
    [...names].map((name) => [name, mergeSamples(previous[name], next[name])])
  );
};
/** Applies visibility to the combined sample, including nested fields from other branches. */
const filterSample = (
  value: unknown,
  schema: ApiSchema,
  model: ApiModel,
  mode: SampleMode,
  seen: string[] = []
): unknown => {
  const target = resolveSchema(schema, model);
  const hidden = mode === "request" ? "readOnly" : "writeOnly";
  const path = schema.ref ? [...seen, schema.ref] : seen;

  if (target?.[hidden]) return undefined;

  if (!target || (schema.ref && seen.includes(schema.ref))) return value;

  let filtered = value;

  for (const part of target.allOf ?? []) {
    filtered = filterSample(filtered, part, model, mode, path);
  }

  if (Array.isArray(filtered) && target.items) {
    const items = target.items;

    return filtered.map((item) => filterSample(item, items, model, mode, path));
  }

  if (!isObject(filtered)) return filtered;

  return Object.fromEntries(
    Object.entries(filtered).flatMap(([name, item]) => {
      const property = target.properties?.find((property) => property.name === name);
      const sample = property ? filterSample(item, property.schema, model, mode, path) : item;

      return sample === undefined ? [] : [[name, sample]];
    })
  );
};
/**
 * Creates a sample value for a schema: its example, constant, default, or first enum value, or a
 * value from its type. Recursive schemas stop at their first repetition.
 */
const createSample = (
  schema: ApiSchema,
  model: ApiModel,
  mode: SampleMode,
  seen: string[] = []
): unknown => {
  if (schema.ref) {
    const target = resolveSchema(schema, model);

    if (!target || seen.includes(schema.ref) || seen.length >= maxDepth) return undefined;

    return createSample(target, model, mode, [...seen, schema.ref]);
  }

  const explicit = [schema.examples?.[0], schema.const, schema.default, schema.enum?.[0]];
  const value = explicit.find((item) => item !== undefined);

  if (value !== undefined) return value;

  if (schema.allOf) {
    const { allOf, ...own } = schema;

    const sample = [...allOf, own].reduce<unknown>((merged, part) => {
      const sample = createSample(part, model, mode, seen);

      return mergeSamples(merged, sample);
    }, undefined);

    return filterSample(sample, schema, model, mode);
  }

  const option = schema.oneOf?.[0] ?? schema.anyOf?.[0];

  if (option) {
    const { oneOf: _oneOf, anyOf: _anyOf, ...own } = schema;

    return createSample({ allOf: [own, option] }, model, mode, seen);
  }

  if (schema.type?.includes("array") || schema.items) {
    const item = schema.items && createSample(schema.items, model, mode, seen);

    return item === undefined ? [] : [item];
  }

  if (schema.type?.includes("object") || schema.properties) {
    const hidden = mode === "request" ? "readOnly" : "writeOnly";
    const entries = (schema.properties ?? []).flatMap(({ name, schema: property }) => {
      const target = resolveSchema(property, model);
      const sample = target?.[hidden] ? undefined : createSample(property, model, mode, seen);

      return sample === undefined ? [] : [[name, sample]];
    });

    return Object.fromEntries(entries);
  }

  return toTypeSample(schema);
};

export { createSample };
export type { SampleMode };
