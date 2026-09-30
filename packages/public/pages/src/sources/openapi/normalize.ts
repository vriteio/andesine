import type {
  ApiCodeSample,
  ApiExample,
  ApiHeader,
  ApiMediaType,
  ApiModel,
  ApiOperation,
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  ApiSchema,
  ApiServer,
  ApiTag
} from "./model";

interface NormalizedSpec {
  model: ApiModel;
  /** Spec features that the reference leaves out, for build warnings. */
  ignored: string[];
}

type RawObject = Record<string, unknown>;

// OpenAPI ignores header parameters with these names; the spec sets them in other ways.
const reservedHeaders = ["accept", "content-type", "authorization"];
const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const constraintKeys = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties"
];
const exclusiveKeys = [
  ["exclusiveMinimum", "minimum"],
  ["exclusiveMaximum", "maximum"]
] as const;
const schemaPrefix = "#/components/schemas/";

const isObject = (value: unknown): value is RawObject => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
const toObject = (value: unknown): RawObject => (isObject(value) ? value : {});
/** Makes a label from an identifier-like tag name, e.g. `schemaMigrations` or `type-metadata`. */
const toTagLabel = (name: string): string => {
  if (!/^[a-z][a-zA-Z\d]*(?:[-_][a-zA-Z\d]+)*$/.test(name)) return name;

  const words = name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .join(" ")
    .toLowerCase();

  return `${words[0]!.toUpperCase()}${words.slice(1)}`;
};
const toText = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};
/** Removes `undefined` fields, so the stored model stays small. */
const compact = <T extends object>(value: T): T => {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
};
/** Decodes URI escapes; keys can contain a bare `%`, which is not an escape. */
const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
const unescapeSegment = (segment: string): string => {
  return decodeSegment(segment).replaceAll("~1", "/").replaceAll("~0", "~");
};
/** Reads a local JSON pointer, such as `#/components/schemas/Pet`. */
const readPointer = (document: RawObject, ref: string): unknown => {
  return ref
    .slice(2)
    .split("/")
    .map(unescapeSegment)
    .reduce<unknown>((value, key) => {
      if (Array.isArray(value)) {
        return /^(0|[1-9]\d*)$/.test(key) ? value[Number(key)] : undefined;
      }

      return isObject(value) ? value[key] : undefined;
    }, document);
};
/** Schema examples: 3.1 `examples`, or the 3.0 `example`. */
const toSchemaExamples = (raw: RawObject): unknown[] | undefined => {
  if (Array.isArray(raw.examples)) return raw.examples;

  return raw.example === undefined ? undefined : [raw.example];
};
/** Normalizes a spec; `label` names its source in errors. */
const normalizeSpec = (
  document: RawObject,
  label: string,
  baseURL = "https://api.example.com"
): NormalizedSpec => {
  const info = toObject(document.info);
  const components = toObject(document.components);
  const schemas: Record<string, ApiSchema> = {};
  const schemaNames = new Map<string, string>();
  const usedNames = new Set<string>();
  const ignored = new Set<string>();
  const supportsSchemaSiblings = String(document.openapi).startsWith("3.1.");
  /** Follows references of parameters, responses, and other objects, which cannot recurse. */
  const resolve = (value: unknown, depth = 0): RawObject => {
    const ref = isObject(value) ? value.$ref : undefined;

    if (typeof ref !== "string" || depth > 20) return toObject(value);

    return resolve(readPointer(document, ref), depth + 1);
  };
  const toSchemaName = (ref: string): string => {
    const base = ref.startsWith(schemaPrefix)
      ? unescapeSegment(ref.slice(schemaPrefix.length))
      : unescapeSegment(ref.split("/").at(-1) ?? "Schema");

    let name = base;

    for (let index = 2; usedNames.has(name); index++) name = `${base}${index}`;

    usedNames.add(name);

    return name;
  };
  const toSchemaList = (value: unknown): ApiSchema[] | undefined => {
    return Array.isArray(value) ? value.map(toSchema) : undefined;
  };
  /** Named schemas become references, so recursive schemas stay finite. */
  const toSchema = (value: unknown): ApiSchema => {
    if (value === true) return {};
    if (value === false) return { not: {} };

    const raw = toObject(value);

    if (typeof raw.$ref === "string") {
      let name = schemaNames.get(raw.$ref);

      if (!name) {
        name = toSchemaName(raw.$ref);
        schemaNames.set(raw.$ref, name);
        schemas[name] = {};
        schemas[name] = toSchema(readPointer(document, raw.$ref));
      }

      const reference = compact({
        ref: name,
        description: toText(raw.description),
        default: raw.default,
        examples: toSchemaExamples(raw),
        deprecated: raw.deprecated === true || undefined,
        readOnly: raw.readOnly === true || undefined,
        writeOnly: raw.writeOnly === true || undefined
      });
      const { $ref: _ref, ...siblings } = raw;
      const schema = supportsSchemaSiblings ? toSchema(siblings) : {};
      const hasConstraints = Object.keys(schema).some((key) => !(key in reference));

      if (hasConstraints) {
        return { ...schema, allOf: [{ ref: name }, ...(schema.allOf ?? [])] };
      }

      return reference;
    }

    const types = raw.type === undefined ? [] : [raw.type].flat().map(String);
    const required = Array.isArray(raw.required) ? raw.required.map(String) : [];
    const properties = isObject(raw.properties) ? Object.entries(raw.properties) : undefined;
    const constraints = Object.fromEntries(
      constraintKeys.filter((key) => raw[key] !== undefined).map((key) => [key, raw[key]])
    );
    const examples = toSchemaExamples(raw);

    // OpenAPI 3.0 `nullable` has no effect without a `type`.
    if (raw.nullable === true && types.length && !types.includes("null")) types.push("null");

    // OpenAPI 3.0 makes `minimum` and `maximum` exclusive with booleans; 3.1 uses the limits.
    for (const [exclusive, limit] of exclusiveKeys) {
      if (typeof constraints[exclusive] !== "boolean") continue;

      if (constraints[exclusive] && constraints[limit] !== undefined) {
        constraints[exclusive] = constraints[limit];
        delete constraints[limit];
      } else {
        delete constraints[exclusive];
      }
    }

    return compact({
      type: types.length ? types : undefined,
      format: toText(raw.format),
      contentMediaType: toText(raw.contentMediaType),
      contentEncoding: toText(raw.contentEncoding),
      title: toText(raw.title),
      description: toText(raw.description),
      enum: Array.isArray(raw.enum) ? raw.enum : undefined,
      const: raw.const,
      default: raw.default,
      examples,
      deprecated: raw.deprecated === true || undefined,
      readOnly: raw.readOnly === true || undefined,
      writeOnly: raw.writeOnly === true || undefined,
      required: required.length ? required : undefined,
      properties: properties?.map(([name, schema]) => {
        return { name, required: required.includes(name), schema: toSchema(schema) };
      }),
      additionalProperties:
        typeof raw.additionalProperties === "boolean"
          ? raw.additionalProperties
          : raw.additionalProperties === undefined
            ? undefined
            : toSchema(raw.additionalProperties),
      items: raw.items === undefined ? undefined : toSchema(raw.items),
      allOf: toSchemaList(raw.allOf),
      oneOf: toSchemaList(raw.oneOf),
      anyOf: toSchemaList(raw.anyOf),
      not: raw.not === undefined ? undefined : toSchema(raw.not),
      discriminator: isObject(raw.discriminator)
        ? (raw.discriminator as ApiSchema["discriminator"])
        : undefined,
      constraints: Object.keys(constraints).length ? constraints : undefined
    });
  };
  const toExamples = (raw: RawObject): ApiExample[] => {
    if (isObject(raw.examples)) {
      return Object.entries(raw.examples).map(([name, example]) => {
        const resolved = resolve(example);

        return compact({ name, summary: toText(resolved.summary), value: resolved.value });
      });
    }

    return raw.example === undefined ? [] : [{ value: raw.example }];
  };
  const toMediaTypes = (content: unknown): ApiMediaType[] => {
    return Object.entries(toObject(content)).map(([type, media]) => {
      const raw = resolve(media);

      return compact({
        type,
        schema: raw.schema === undefined ? undefined : toSchema(raw.schema),
        examples: toExamples(raw),
        encoding: isObject(raw.encoding)
          ? Object.fromEntries(
              Object.entries(raw.encoding).map(([name, value]) => {
                const encoding = toObject(value);

                return [
                  name,
                  compact({
                    contentType: toText(encoding.contentType),
                    style: toText(encoding.style),
                    explode: typeof encoding.explode === "boolean" ? encoding.explode : undefined
                  })
                ];
              })
            )
          : undefined
      });
    });
  };
  const toParameter = (value: unknown): ApiParameter => {
    const raw = resolve(value);
    const [media] = toMediaTypes(raw.content);
    const examples = toExamples(raw);

    return compact({
      name: String(raw.name),
      in: raw.in as ApiParameter["in"],
      required: raw.in === "path" || raw.required === true,
      deprecated: raw.deprecated === true,
      description: toText(raw.description),
      schema: raw.schema === undefined ? media?.schema : toSchema(raw.schema),
      // A parameter with `content` can have its examples there.
      examples: examples.length ? examples : (media?.examples ?? []),
      mediaType: raw.schema === undefined ? media?.type : undefined,
      style: toText(raw.style),
      explode: typeof raw.explode === "boolean" ? raw.explode : undefined
    });
  };
  /** Response headers; OpenAPI ignores a `Content-Type` header, which the content sets. */
  const toHeaders = (headers: unknown): ApiHeader[] => {
    const entries = Object.entries(toObject(headers)).filter(([name]) => {
      return name.toLowerCase() !== "content-type";
    });

    return entries.map(([name, header]) => {
      const raw = resolve(header);

      return compact({
        name,
        required: raw.required === true,
        description: toText(raw.description),
        schema: raw.schema === undefined ? undefined : toSchema(raw.schema)
      });
    });
  };
  const toRequestBody = (value: unknown): ApiRequestBody => {
    const raw = resolve(value);

    return compact({
      required: raw.required === true,
      description: toText(raw.description),
      contents: toMediaTypes(raw.content)
    });
  };
  const toResponses = (responses: unknown): ApiResponse[] => {
    const entries = Object.entries(toObject(responses)).filter(
      ([status]) => !status.startsWith("x-")
    );

    return entries.map(([status, response]) => {
      const raw = resolve(response);

      return compact({
        status,
        description: toText(raw.description),
        headers: toHeaders(raw.headers),
        contents: toMediaTypes(raw.content)
      });
    });
  };
  const toServers = (value: unknown): ApiServer[] | undefined => {
    return Array.isArray(value)
      ? value.map((server) => {
          const raw = toObject(server);
          const variables = toObject(raw.variables);
          // Variables, e.g. `{region}`, take their default values.
          const url = String(raw.url).replace(/\{([^}]+)\}/g, (match, name: string) => {
            const value = toObject(variables[name]).default;

            return value === undefined ? match : String(value);
          });

          return compact({ url: new URL(url, baseURL).href, description: toText(raw.description) });
        })
      : undefined;
  };
  const toCodeSamples = (raw: RawObject): ApiCodeSample[] => {
    const samples = raw["x-codeSamples"] ?? raw["x-code-samples"];

    return (Array.isArray(samples) ? samples : []).filter(isObject).map((sample) => {
      const lang = String(sample.lang);

      return { lang, label: toText(sample.label) ?? lang, source: String(sample.source) };
    });
  };
  const servers = toServers(document.servers) ?? [];
  const operations = Object.entries(toObject(document.paths)).flatMap(([path, item]) => {
    const pathItem = resolve(item);
    const pathParameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    return methods.flatMap((method): ApiOperation[] => {
      const raw = pathItem[method];

      if (!isObject(raw)) return [];

      if (raw.callbacks) ignored.add("callbacks");

      const parameters = new Map<string, ApiParameter>();
      const operationParameters = Array.isArray(raw.parameters) ? raw.parameters : [];

      // Operation parameters replace path parameters with the same name and place.
      [...pathParameters, ...operationParameters].map(toParameter).forEach((parameter) => {
        const isHeader = parameter.in === "header";
        const name = isHeader ? parameter.name.toLowerCase() : parameter.name;

        if (isHeader && reservedHeaders.includes(name)) return;

        parameters.set(`${parameter.in}:${name}`, parameter);
      });

      return [
        compact({
          id: toText(raw.operationId) ?? `${method.toUpperCase()} ${path}`,
          method,
          path,
          summary: toText(raw.summary),
          description: toText(raw.description),
          deprecated: raw.deprecated === true,
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
          parameters: [...parameters.values()],
          requestBody: raw.requestBody === undefined ? undefined : toRequestBody(raw.requestBody),
          responses: toResponses(raw.responses),
          security: (Array.isArray(raw.security)
            ? raw.security
            : (document.security ?? [])) as Array<Record<string, string[]>>,
          servers: toServers(raw.servers) ?? toServers(pathItem.servers) ?? servers,
          codeSamples: toCodeSamples(raw),
          extensions: Object.fromEntries(
            Object.entries(raw).filter(([key]) => {
              return key.startsWith("x-") && key !== "x-codeSamples" && key !== "x-code-samples";
            })
          )
        })
      ];
    });
  });
  const declaredTags = (Array.isArray(document.tags) ? document.tags : [])
    .filter(isObject)
    .map((tag): ApiTag => {
      const name = String(tag.name);

      return compact({
        name,
        label: toText(tag["x-displayName"]) ?? toTagLabel(name),
        description: toText(tag.description)
      });
    });
  const operationIDs = new Set<string>();
  // Operations show in their first tag only, so other tags make no groups.
  const usedTags = new Set(operations.flatMap((operation) => operation.tags.slice(0, 1)));
  const tags = [
    ...declaredTags.filter((tag) => usedTags.has(tag.name)),
    ...[...usedTags]
      .filter((name) => !declaredTags.some((tag) => tag.name === name))
      .map((name) => ({ name, label: toTagLabel(name) }))
  ];

  operations.forEach((operation) => {
    if (operationIDs.has(operation.id)) {
      throw new Error(`${label}: more than one operation uses the operation ID "${operation.id}".`);
    }

    operationIDs.add(operation.id);
  });

  if (document.webhooks) ignored.add("webhooks");

  return {
    model: compact({
      title: toText(info.title) ?? "API",
      version: String(info.version ?? ""),
      description: toText(info.description),
      servers,
      securitySchemes: Object.entries(toObject(components.securitySchemes)).map(([id, scheme]) => {
        const raw = resolve(scheme);

        return compact({
          id,
          type: String(raw.type),
          description: toText(raw.description),
          scheme: toText(raw.scheme),
          bearerFormat: toText(raw.bearerFormat),
          name: toText(raw.name),
          in: toText(raw.in)
        });
      }),
      tags,
      operations,
      schemas
    }),
    ignored: [...ignored]
  };
};

export { normalizeSpec, isObject };
export type { NormalizedSpec };
