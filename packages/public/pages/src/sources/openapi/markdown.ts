import { toLabel, toLine } from "../../output/markdown";
import type { OpenAPIContent } from "../types";
import { toFacts, toOperationTitle, toSchemeLabel, toTypeLabel } from "./labels";
import {
  resolveSchema,
  resolveSchemaDetails,
  getRequiredNames,
  type ApiMediaType,
  type ApiModel,
  type ApiOperation,
  type ApiParameter,
  type ApiSchema,
  type ApiTag
} from "./model";

interface OpenAPILinks {
  /** URL paths by operation ID. */
  operations: Record<string, string>;
  /** URL paths of tag landing pages by tag name. */
  tags: Record<string, string>;
}

interface MarkdownOptions {
  model: ApiModel;
  links: OpenAPILinks;
  /** Maps a URL path to the URL in the output, e.g. an absolute URL. */
  toURL(href: string): string;
}

/** Parameter details that override their schema's. */
interface FieldOverrides {
  description?: string;
  deprecated?: boolean;
}

interface FieldSchemas {
  name: string;
  required: boolean;
  schemas: ApiSchema[];
}

interface SchemaVariant {
  schema: ApiSchema;
  label: string;
  index: number;
  required: Set<string>;
}

type ToURL = MarkdownOptions["toURL"];

const locations: Array<[ApiParameter["in"], string]> = [
  ["path", "Path"],
  ["query", "Query"],
  ["header", "Header"],
  ["cookie", "Cookie"]
];

/** A description as one sentence line, so facts can follow it. */
const toSentence = (description: string): string => {
  const line = toLine(description);

  return /[.!?:]$/.test(line) ? line : `${line}.`;
};
const typeLabel = (schema: ApiSchema): string => toTypeLabel(schema, (name) => `\`${name}\``);
/** Values, defaults, and limits of a schema, as sentences. */
const toFactLines = (...schemas: ApiSchema[]): string[] => {
  const facts = new Map(schemas.flatMap(toFacts).map((fact) => [fact.label, fact]));

  return [...facts.values()].map(
    (fact) => `${fact.label}: ${fact.values.map((value) => `\`${value}\``).join(", ")}.`
  );
};
/**
 * Writes schemas as nested lists. A named schema expands once for each page; later uses show
 * its name only, so recursive schemas stay finite.
 */
const createSchemaWriter = (model: ApiModel) => {
  const expanded = new Set<string>();
  const lines: string[] = [];
  const resolve = (schema: ApiSchema): ApiSchema | undefined => {
    if (!schema.ref) return schema;
    if (expanded.has(schema.ref)) return undefined;

    expanded.add(schema.ref);

    return resolveSchema(schema, model);
  };
  const writeField = (
    name: string,
    required: boolean,
    schemas: ApiSchema[],
    depth: number,
    overrides: FieldOverrides = {}
  ) => {
    const targets = schemas.flatMap((schema) => resolveSchemaDetails(schema, model) ?? []);
    const flags = [
      schemas
        .map((schema) =>
          typeLabel(schema.ref ? schema : (resolveSchemaDetails(schema, model) ?? schema))
        )
        .filter((type) => type !== "any")
        .at(-1) ?? "any",
      required ? "required" : "optional",
      (overrides.deprecated || targets.some((target) => target.deprecated)) && "deprecated",
      targets.some((target) => target.readOnly) && "read-only",
      targets.some((target) => target.writeOnly) && "write-only"
    ].filter(Boolean);
    const description =
      overrides.description ??
      targets
        .map((target) => target.description)
        .filter((description) => description !== undefined)
        .at(-1);
    const text = [description && toSentence(description), ...toFactLines(...targets)];

    lines.push(
      `${"  ".repeat(depth)}- \`${name}\` (${flags.join(", ")})${text.some(Boolean) ? `: ${text.filter(Boolean).join(" ")}` : ""}`
    );
    writeChildren(schemas, depth + 1);
  };
  /** Collects all definitions before writing a field, so later `allOf` details are retained. */
  const writeChildren = (
    schemas: ApiSchema[],
    depth: number,
    required = new Set<string>()
  ): void => {
    const fields = new Map<string, FieldSchemas>();
    const variants: SchemaVariant[] = [];
    const requiredNames = new Set([
      ...required,
      ...schemas.flatMap((schema) => getRequiredNames(schema, model))
    ]);
    const collect = (schema: ApiSchema, required: Set<string>): void => {
      const target = resolve(schema);
      const requiredNames = new Set([...required, ...getRequiredNames(schema, model)]);
      const properties = [
        ...(target?.properties ?? []),
        ...(typeof target?.additionalProperties === "object"
          ? [{ name: "{key}", required: false, schema: target.additionalProperties }]
          : [])
      ];

      if (!target) return;

      properties.forEach((property) => {
        const field = fields.get(property.name) ?? {
          name: property.name,
          required: false,
          schemas: []
        };

        field.required ||= property.required || requiredNames.has(property.name);
        field.schemas.push(property.schema);
        fields.set(property.name, field);
      });

      if (target.items) collect(target.items, new Set());

      target.allOf?.forEach((part) => collect(part, requiredNames));

      for (const [key, label] of [
        ["oneOf", "One of"],
        ["anyOf", "Any of"]
      ] as const) {
        target[key]?.forEach((option, index) => {
          variants.push({ schema: option, label, index, required: requiredNames });
        });
      }
    };

    schemas.forEach((schema) => collect(schema, requiredNames));
    fields.forEach((field) => writeField(field.name, field.required, field.schemas, depth));
    variants.forEach(({ schema, label, index, required }) => {
      const target = resolveSchemaDetails(schema, model);
      const name = schema.ref
        ? `\`${schema.ref}\``
        : `${schema.title ?? `Option ${index + 1}`} (${typeLabel(target ?? schema)})`;
      const facts = target ? toFactLines(target) : [];

      lines.push(
        `${"  ".repeat(depth)}- ${label}: ${name}${facts.length ? `. ${facts.join(" ")}` : ""}`
      );
      writeChildren([schema], depth + 1, required);
    });
  };

  return {
    /** Writes one field and its nested fields, e.g. a parameter. */
    field: (
      name: string,
      required: boolean,
      schema: ApiSchema,
      overrides?: FieldOverrides
    ): string => {
      const start = lines.length;

      writeField(name, required, [schema], 0, overrides);

      return lines.splice(start).join("\n");
    },
    /** Writes the fields of a schema, or its type when it has no fields. */
    write: (schema: ApiSchema): string => {
      const start = lines.length;

      writeChildren([schema], 0);

      const fields = lines.splice(start);
      const target = resolveSchemaDetails(schema, model);
      const type = typeLabel(schema.ref ? schema : (target ?? schema));

      return [
        type === "object" ? "" : `Type: ${type}.`,
        target?.description,
        ...(target ? toFactLines(target) : []),
        fields.join("\n")
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  };
};
const toMediaMarkdown = (
  media: ApiMediaType,
  writer: ReturnType<typeof createSchemaWriter>
): string[] => {
  return [`Content type: \`${media.type}\``, ...(media.schema ? [writer.write(media.schema)] : [])];
};
const toSecurityMarkdown = (operation: ApiOperation, model: ApiModel): string[] => {
  if (!operation.security.length) return [];

  const items = operation.security.map((requirement) => {
    const schemes = Object.entries(requirement).map(([id, scopes]) => {
      const scheme = model.securitySchemes.find((item) => item.id === id);
      const kind = scheme ? toSchemeLabel(scheme) : "";

      return `\`${id}\`${kind ? ` (${kind})` : ""}${scopes.length ? `, scopes: ${scopes.join(", ")}` : ""}`;
    });

    return `- ${schemes.join(" and ") || "No authentication"}`;
  });

  return ["## Authentication", items.length > 1 ? `Use one of:\n\n${items.join("\n")}` : items[0]!];
};
const toOperationMarkdown = (operation: ApiOperation, options: MarkdownOptions): string => {
  const writer = createSchemaWriter(options.model);
  const parameters = locations.flatMap(([location, label]) => {
    const items = operation.parameters.filter((parameter) => parameter.in === location);

    return items.length
      ? [
          `### ${label}`,
          items
            .map((parameter) => {
              return writer.field(parameter.name, parameter.required, parameter.schema ?? {}, {
                description: parameter.description,
                deprecated: parameter.deprecated
              });
            })
            .join("\n")
        ]
      : [];
  });
  const body = operation.requestBody;
  const responses = operation.responses.flatMap((response) => {
    return [
      `### ${response.status}`,
      ...(response.description ? [response.description] : []),
      ...(response.headers.length
        ? [
            "#### Headers",
            response.headers
              .map((header) => {
                return writer.field(header.name, header.required, header.schema ?? {}, {
                  description: header.description
                });
              })
              .join("\n")
          ]
        : []),
      ...response.contents.flatMap((media) => toMediaMarkdown(media, writer))
    ];
  });

  const server = operation.servers[0]?.url.replace(/\/$/, "") ?? "";

  return [
    `\`${operation.method.toUpperCase()} ${server}${operation.path}\``,
    ...(operation.deprecated ? ["> This operation is deprecated."] : []),
    ...(operation.description ? [operation.description] : []),
    ...toSecurityMarkdown(operation, options.model),
    ...(parameters.length ? ["## Parameters", ...parameters] : []),
    ...(body
      ? [
          "## Request body",
          ...(body.description ? [body.description] : []),
          body.required ? "The body is required." : "The body is optional.",
          ...body.contents.flatMap((media) => toMediaMarkdown(media, writer))
        ]
      : []),
    ...(responses.length ? ["## Responses", ...responses] : [])
  ].join("\n\n");
};
const toOperationLinks = (operations: ApiOperation[], options: MarkdownOptions): string => {
  return operations
    .map((operation) => {
      const href = options.toURL(options.links.operations[operation.id]!);

      return `- [${toLabel(toOperationTitle(operation))}](${href}): \`${operation.method.toUpperCase()} ${operation.path}\``;
    })
    .join("\n");
};
const toTagMarkdown = (tag: ApiTag, options: MarkdownOptions): string => {
  const operations = options.model.operations.filter((operation) => {
    return operation.tags[0] === tag.name;
  });

  return [
    ...(tag.description ? [tag.description] : []),
    "## Operations",
    toOperationLinks(operations, options)
  ].join("\n\n");
};
const toOverviewMarkdown = (options: MarkdownOptions): string => {
  const { model } = options;
  const servers = model.servers.map((server) => {
    return `- \`${server.url}\`${server.description ? `: ${toLine(server.description)}` : ""}`;
  });
  const schemes = model.securitySchemes.map((scheme) => {
    return `- \`${scheme.id}\` (${toSchemeLabel(scheme)})${scheme.description ? `: ${toLine(scheme.description)}` : ""}`;
  });

  return [
    ...(model.description ? [model.description] : []),
    ...(servers.length ? ["## Servers", servers.join("\n")] : []),
    ...(schemes.length ? ["## Authentication", schemes.join("\n")] : [])
  ].join("\n\n");
};

/** The Markdown of an overview, tag, or operation page. */
const toOpenAPIMarkdown = (content: OpenAPIContent, toURL: ToURL): string => {
  const options = { model: content.model, links: content.links, toURL };

  if (content.operation) return toOperationMarkdown(content.operation, options);
  if (content.tag) return toTagMarkdown(content.tag, options);

  return toOverviewMarkdown(options);
};

export { toOpenAPIMarkdown };
export type { OpenAPILinks, MarkdownOptions };
