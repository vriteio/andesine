import { entryVersionProperties as properties } from "#backend/db/version-properties";
import {
  normalizePropertyDate,
  normalizePropertyText,
  type PropertyFilter
} from "#backend/lib/content/properties";
import {
  and,
  eq,
  gt,
  gte,
  isNotNull,
  lt,
  lte,
  ne,
  sql,
  type SQL,
  type SQLWrapper
} from "drizzle-orm";

interface VersionPropertyFilterInput {
  workspaceID: string | SQLWrapper;
  versionID: string | SQLWrapper;
  filters: PropertyFilter[];
}

const getPropertyValuePredicate = (filter: PropertyFilter): SQL => {
  if (filter.kind === "text") {
    const values = sql`ARRAY[${sql.join(
      filter.values.map((value) => sql`${normalizePropertyText(value)}`),
      sql`, `
    )}]::text[]`;

    if (filter.operator === "all") return sql`${properties.textValue} @> ${values}`;
    if (filter.operator === "none") return sql`NOT (${properties.textValue} && ${values})`;

    return sql`${properties.textValue} && ${values}`;
  }

  if (filter.kind === "boolean") return eq(properties.booleanValue, filter.value);

  const column = filter.kind === "date" ? properties.dateValue : properties.numberValue;
  const value = filter.kind === "date" ? normalizePropertyDate(filter.value) : filter.value;
  const operators = {
    equals: eq,
    notEquals: ne,
    greaterThan: gt,
    greaterThanOrEqual: gte,
    lessThan: lt,
    lessThanOrEqual: lte
  };

  if (value === undefined || !Number.isFinite(value)) return sql`false`;

  return and(isNotNull(column), operators[filter.operator](column, value))!;
};
// Correlate each filter to the selected version before pagination. EXISTS also
// keeps missing properties from matching negative operators.
const getVersionPropertyFilter = (input: VersionPropertyFilterInput): SQL | undefined => {
  const kinds = {
    text: sql`'text'`,
    number: sql`'number'`,
    boolean: sql`'boolean'`,
    date: sql`'date'`
  };

  return and(
    ...input.filters.map(
      (filter) => sql`EXISTS (
    SELECT 1 FROM ${properties}
    WHERE ${properties.workspaceID} = ${input.workspaceID}
      AND ${properties.versionID} = ${input.versionID}
      AND ${properties.key} = ${filter.key}
      AND ${properties.kind} = ${kinds[filter.kind]}
      AND ${getPropertyValuePredicate(filter)}
  )`
    )
  );
};

export { getVersionPropertyFilter };
export type { VersionPropertyFilterInput };
