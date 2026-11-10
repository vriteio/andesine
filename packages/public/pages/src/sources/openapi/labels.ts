import type { ApiOperation, ApiSchema, ApiSecurityScheme } from "./model";

interface Fact {
  label: string;
  /** Values as JSON, e.g. `"dog"` or `100`. */
  values: string[];
}

const constraintLabels: Record<string, string> = {
  minimum: "Minimum",
  maximum: "Maximum",
  exclusiveMinimum: "Greater than",
  exclusiveMaximum: "Less than",
  multipleOf: "Multiple of",
  minLength: "Min length",
  maxLength: "Max length",
  pattern: "Pattern",
  minItems: "Min items",
  maxItems: "Max items",
  uniqueItems: "Unique items",
  minProperties: "Min properties",
  maxProperties: "Max properties"
};
const statusLabels: Record<string, string> = {
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "204": "No Content",
  "301": "Moved Permanently",
  "302": "Found",
  "304": "Not Modified",
  "400": "Bad Request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "409": "Conflict",
  "410": "Gone",
  "412": "Precondition Failed",
  "413": "Content Too Large",
  "415": "Unsupported Media Type",
  "422": "Unprocessable Content",
  "429": "Too Many Requests",
  "500": "Internal Server Error",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "1XX": "Informational",
  "2XX": "Success",
  "3XX": "Redirection",
  "4XX": "Client Error",
  "5XX": "Server Error",
  "default": "Other responses"
};

/** A schema's type, e.g. `string (date-time)` or `array of Pet`. `formatName` formats names. */
const toTypeLabel = (
  schema: ApiSchema,
  formatName: (name: string) => string = (name) => name
): string => {
  if (schema.ref) return formatName(schema.ref);

  const types = (schema.type ?? []).map((type) => {
    if (type === "array" && schema.items) {
      return `array of ${toTypeLabel(schema.items, formatName)}`;
    }

    return schema.format && type !== "null" ? `${type} (${schema.format})` : type;
  });

  if (types.length) return types.join(" or ");
  if (schema.oneOf) return "one of";
  if (schema.anyOf) return "any of";
  if (schema.allOf) return "all of";

  return schema.const === undefined ? "any" : "constant";
};
/** Allowed values, defaults, and limits of a schema. */
const toFacts = (schema: ApiSchema): Fact[] => {
  const json = (value: unknown): string => JSON.stringify(value);

  return [
    ...(schema.enum ? [{ label: "One of", values: schema.enum.map(json) }] : []),
    ...(schema.const === undefined ? [] : [{ label: "Value", values: [json(schema.const)] }]),
    ...(schema.default === undefined ? [] : [{ label: "Default", values: [json(schema.default)] }]),
    ...Object.entries(schema.constraints ?? {}).map(([key, value]) => {
      return { label: constraintLabels[key] ?? key, values: [json(value)] };
    })
  ];
};
/** A security scheme's kind, e.g. `http, bearer, JWT` or `apiKey, header X-API-Key`. */
const toSchemeLabel = (scheme: ApiSecurityScheme): string => {
  const place = scheme.in && scheme.name ? `${scheme.in} ${scheme.name}` : undefined;

  return [scheme.type, scheme.scheme, scheme.bearerFormat, place].filter(Boolean).join(", ");
};
/** An operation's summary, or its method and path without one. */
const toOperationTitle = (operation: ApiOperation): string => {
  return operation.summary ?? `${operation.method.toUpperCase()} ${operation.path}`;
};
/** The text of a response status, e.g. `Not Found` for `404`. */
const toStatusLabel = (status: string): string | undefined => {
  return statusLabels[status.toUpperCase()] ?? statusLabels[status];
};

export { toTypeLabel, toFacts, toSchemeLabel, toOperationTitle, toStatusLabel };
export type { Fact };
