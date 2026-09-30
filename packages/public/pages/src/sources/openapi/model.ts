interface ApiModel {
  title: string;
  version: string;
  /** Markdown. */
  description?: string;
  servers: ApiServer[];
  securitySchemes: ApiSecurityScheme[];
  /** Tags in the order of the spec's `tags`, then in order of first use. */
  tags: ApiTag[];
  operations: ApiOperation[];
  /** Named schemas, which `ApiSchema.ref` points to. */
  schemas: Record<string, ApiSchema>;
}

interface ApiServer {
  /** Absolute URL with server variables resolved. */
  url: string;
  description?: string;
}

interface ApiSecurityScheme {
  id: string;
  type: string;
  /** Markdown. */
  description?: string;
  /** For `http` schemes, e.g. `bearer`. */
  scheme?: string;
  bearerFormat?: string;
  /** For `apiKey` schemes: the name and place of the key. */
  name?: string;
  in?: string;
}

interface ApiTag {
  name: string;
  label: string;
  /** Markdown. */
  description?: string;
}

interface ApiOperation {
  /** The `operationId`, or `{method}-{path}` without one. */
  id: string;
  method: string;
  path: string;
  summary?: string;
  /** Markdown. */
  description?: string;
  deprecated: boolean;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  /** Alternative requirements; each maps scheme IDs to scopes. Empty means no authentication. */
  security: Array<Record<string, string[]>>;
  servers: ApiServer[];
  /** From `x-codeSamples` or `x-code-samples`. */
  codeSamples: ApiCodeSample[];
  /** The `x-` fields of the operation. */
  extensions: Record<string, unknown>;
}

interface ApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  deprecated: boolean;
  /** Markdown. */
  description?: string;
  schema?: ApiSchema;
  examples: ApiExample[];
  /** The media type of a parameter with `content`, whose values are written in that type. */
  mediaType?: string;
  /** How values are written, e.g. `form` or `deepObject`; unset for the default of the place. */
  style?: string;
  explode?: boolean;
}

interface ApiRequestBody {
  required: boolean;
  /** Markdown. */
  description?: string;
  contents: ApiMediaType[];
}

interface ApiResponse {
  /** A status code, a range such as `4XX`, or `default`. */
  status: string;
  /** Markdown. */
  description?: string;
  headers: ApiHeader[];
  contents: ApiMediaType[];
}

interface ApiHeader {
  name: string;
  required: boolean;
  /** Markdown. */
  description?: string;
  schema?: ApiSchema;
}

interface ApiMediaType {
  type: string;
  schema?: ApiSchema;
  examples: ApiExample[];
  encoding?: Record<string, ApiEncoding>;
}

interface ApiEncoding {
  contentType?: string;
  style?: string;
  explode?: boolean;
}

interface ApiExample {
  name?: string;
  summary?: string;
  value: unknown;
}

interface ApiCodeSample {
  lang: string;
  label: string;
  source: string;
}

/** A JSON Schema with 3.0 and 3.1 differences removed, e.g. `nullable` is a `null` type. */
interface ApiSchema {
  /**
   * The name of a schema in `ApiModel.schemas`. Only annotations can be set with it: the
   * description, default, examples, and the deprecated, read-only, and write-only flags.
   */
  ref?: string;
  type?: string[];
  format?: string;
  /** OpenAPI 3.1 content of a string, e.g. `image/png` for a file. */
  contentMediaType?: string;
  contentEncoding?: string;
  title?: string;
  /** Markdown. */
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  required?: string[];
  properties?: ApiProperty[];
  additionalProperties?: ApiSchema | boolean;
  items?: ApiSchema;
  allOf?: ApiSchema[];
  oneOf?: ApiSchema[];
  anyOf?: ApiSchema[];
  not?: ApiSchema;
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
  /** Validation keywords, such as `minimum` or `pattern`. */
  constraints?: Record<string, unknown>;
}

interface ApiProperty {
  name: string;
  required: boolean;
  schema: ApiSchema;
}

/** Resolves a reference; the annotations set with it replace the target's. */
const resolveSchema = (
  schema: ApiSchema,
  model: ApiModel,
  seen: string[] = []
): ApiSchema | undefined => {
  if (!schema.ref) return schema;
  if (seen.includes(schema.ref)) return undefined;

  const target = model.schemas[schema.ref];
  const resolved = target && resolveSchema(target, model, [...seen, schema.ref]);

  return resolved && { ...resolved, ...schema, ref: undefined };
};

/** Combines `allOf` details for display; field expansion still follows the original schema. */
const resolveSchemaDetails = (
  schema: ApiSchema,
  model: ApiModel,
  seen: string[] = []
): ApiSchema | undefined => {
  const target = resolveSchema(schema, model);
  const path = schema.ref ? [...seen, schema.ref] : seen;

  if (!target || (schema.ref && seen.includes(schema.ref))) return undefined;

  const parts = (target.allOf ?? []).flatMap((part) => {
    return resolveSchemaDetails(part, model, path) ?? [];
  });

  return [...parts, target].reduce<ApiSchema>((details, part) => {
    return {
      ...details,
      ...part,
      type: part.type ?? details.type,
      constraints: { ...details.constraints, ...part.constraints },
      deprecated: details.deprecated || part.deprecated,
      readOnly: details.readOnly || part.readOnly,
      writeOnly: details.writeOnly || part.writeOnly
    };
  }, {});
};

/** Required names apply across `allOf` branches, but not to nested objects or array items. */
const getRequiredNames = (schema: ApiSchema, model: ApiModel, seen: string[] = []): string[] => {
  if (schema.ref && seen.includes(schema.ref)) return [];

  const target = resolveSchema(schema, model);
  const path = schema.ref ? [...seen, schema.ref] : seen;

  return [
    ...(target?.required ?? []),
    ...(target?.allOf ?? []).flatMap((part) => getRequiredNames(part, model, path))
  ];
};

export { resolveSchema, resolveSchemaDetails, getRequiredNames };
export type {
  ApiModel,
  ApiServer,
  ApiSecurityScheme,
  ApiTag,
  ApiOperation,
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  ApiHeader,
  ApiMediaType,
  ApiEncoding,
  ApiExample,
  ApiCodeSample,
  ApiSchema,
  ApiProperty
};
