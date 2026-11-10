import type {
  PropertyFilter,
  DatePropertyFilter,
  NumberPropertyFilter
} from "@andesine/contracts/search";
import {
  getContentBlocks,
  type ContentProperty,
  type PropertyType,
  type ContentNode
} from "@andesine/document";

interface TypedPropertyValue {
  key: string;
  name: string;
  type: PropertyType;
  textValue?: string[];
  numberValue?: number;
  booleanValue?: boolean;
  dateValue?: number;
}

const normalizePropertyText = (value: string): string => value.toLowerCase();
const normalizePropertyDate = (value: string): number | undefined => {
  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? undefined : Math.floor(timestamp / 1000);
};
const normalizeProperty = (key: string, property: ContentProperty): TypedPropertyValue => {
  const typedProperty: TypedPropertyValue = {
    key,
    name: property.name,
    type: property.type
  };

  if (property.type === "number") {
    if (typeof property.value === "number" && Number.isFinite(property.value)) {
      typedProperty.numberValue = property.value;
    }
  } else if (property.type === "checkbox") {
    if (typeof property.value === "boolean") typedProperty.booleanValue = property.value;
  } else if (property.type === "date") {
    if (typeof property.value === "string") {
      typedProperty.dateValue = normalizePropertyDate(property.value);
    }
  } else {
    const values = Array.isArray(property.value) ? property.value : [property.value];

    // Empty text arrays still have a value slot; missing numbers and dates do not.
    typedProperty.textValue = values.filter((value): value is string => typeof value === "string");
  }

  return typedProperty;
};
const getContentPropertyValues = (content: ContentNode): TypedPropertyValue[] => {
  return Object.entries(getContentBlocks(content).properties).map(([key, property]) => {
    return normalizeProperty(key, property);
  });
};
const comparePropertyValue = (
  actual: number,
  expected: number,
  operator: DatePropertyFilter["operator"] | NumberPropertyFilter["operator"]
): boolean => {
  if (operator === "equals") return actual === expected;
  if (operator === "notEquals") return actual !== expected;
  if (operator === "greaterThan") return actual > expected;
  if (operator === "greaterThanOrEqual") return actual >= expected;
  if (operator === "lessThan") return actual < expected;

  return actual <= expected;
};
const matchesPropertyFilter = (
  properties: TypedPropertyValue[],
  filter: PropertyFilter
): boolean => {
  const property = properties.find(({ key }) => key === filter.key);

  if (!property) return false;

  if (filter.kind === "text") {
    if (!property.textValue) return false;

    const propertyValues = new Set(property.textValue.map((value) => normalizePropertyText(value)));
    const matches = filter.values.map((value) => {
      return propertyValues.has(normalizePropertyText(value));
    });

    if (filter.operator === "all") return matches.every(Boolean);
    if (filter.operator === "none") return matches.every((match) => !match);

    return matches.some(Boolean);
  }

  if (filter.kind === "boolean") return property.booleanValue === filter.value;

  const value = filter.kind === "date" ? property.dateValue : property.numberValue;
  const expected = filter.kind === "date" ? normalizePropertyDate(filter.value) : filter.value;

  return (
    typeof value === "number" &&
    typeof expected === "number" &&
    comparePropertyValue(value, expected, filter.operator)
  );
};
const matchesPropertyFilters = (
  properties: TypedPropertyValue[],
  filters: PropertyFilter[]
): boolean => {
  return filters.every((filter) => matchesPropertyFilter(properties, filter));
};

export {
  getContentPropertyValues,
  matchesPropertyFilters,
  normalizeProperty,
  normalizePropertyDate,
  normalizePropertyText
};
export type { TypedPropertyValue };
