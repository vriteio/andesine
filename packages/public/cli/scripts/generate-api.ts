import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { format, resolveConfig } from "prettier";
import type { APICommand, APIField, JSONSchema } from "../src/api/types";

interface MediaType {
  schema?: JSONSchema;
}
interface Parameter {
  name: string;
  in: APIField["location"];
  required?: boolean;
  description?: string;
  schema: JSONSchema;
}
interface OpenAPIOperation {
  "operationId": string;
  "summary"?: string;
  "description"?: string;
  "security"?: Array<Record<string, string[]>>;
  "parameters"?: Parameter[];
  "requestBody"?: { content: Record<string, MediaType> };
  "responses": Record<string, { content?: Record<string, MediaType> }>;
  "x-sdk-example"?: Record<string, unknown>;
}
interface OpenAPIDocument {
  openapi: string;
  security?: Array<Record<string, string[]>>;
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components: { schemas: Record<string, JSONSchema> };
}

const root = new URL("../", import.meta.url);
const reserved = new Set([
  "help",
  "input",
  "output",
  "format",
  "paginate",
  "full",
  "timeout",
  "schema",
  "if-none-match",
  "config",
  "profile",
  "base-url",
  "workspace",
  "interactive"
]);
const kebab = (name: string) =>
  name
    .replace(
      /([A-Z]{2,})s\b/g,
      (_match, acronym: string) => `${acronym[0]}${acronym.slice(1).toLowerCase()}s`
    )
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .toLowerCase();

/** Generate only from the checked-in SDK spec; fail rather than omit new contract forms. */
const generateAPI = async (): Promise<void> => {
  const document: OpenAPIDocument = JSON.parse(
    await readFile(new URL("../sdk/openapi.json", root), "utf8")
  );
  const commands: APICommand[] = [];
  const names = new Set<string>();
  const ids = new Set<string>();
  const schemas: Record<string, JSONSchema> = {};
  const resolve = (schema: JSONSchema): JSONSchema => {
    if (!schema.$ref) return schema;

    const name = schema.$ref.replace("#/components/schemas/", "");
    const target = document.components.schemas[name];

    if (!schema.$ref.startsWith("#/components/schemas/") || !target) {
      throw new Error(`Unsupported reference: ${schema.$ref}`);
    }

    if (target.$ref) throw new Error(`Chained root schema reference: ${name}`);

    return { ...target, ...schema, $ref: undefined };
  };
  const collectSchemas = (value: unknown): void => {
    if (!value || typeof value !== "object") return;

    if ("$ref" in value && typeof value.$ref === "string") {
      const name = value.$ref.replace("#/components/schemas/", "");

      if (!Object.hasOwn(schemas, name)) {
        const schema = resolve({ $ref: value.$ref });

        schemas[name] = schema;
        collectSchemas(schema);
      }
    }

    Object.values(value).forEach(collectSchemas);
  };
  const empty = (schema: JSONSchema): boolean => {
    const resolved = resolve(schema);

    return (
      Boolean(
        resolved.not && typeof resolved.not === "object" && !Object.keys(resolved.not).length
      ) || Boolean(resolved.anyOf?.every(empty))
    );
  };

  if (!document.openapi.startsWith("3.1.")) throw new Error("CLI generation requires OpenAPI 3.1.");

  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options"].includes(method)) {
        throw new Error(`Unsupported path member: ${method} ${path}`);
      }

      if (!/^[a-z][A-Za-z\d]*\.[a-z][A-Za-z\d]*$/.test(operation.operationId)) {
        throw new Error(`Unsupported operation ID at ${method} ${path}`);
      }

      const [resource, name] = operation.operationId.split(".");
      const command: APICommand = {
        id: operation.operationId,
        group: kebab(resource),
        command: kebab(name),
        method,
        path,
        summary: operation.summary ?? operation.operationId,
        description: operation.description ?? "",
        example: operation["x-sdk-example"],
        security: operation.security ?? document.security ?? [],
        fields: [],
        conditional: Object.hasOwn(operation.responses, "304"),
        response: "empty"
      };
      const key = `${command.group} ${command.command}`;
      const supportedAuth = command.security.every(
        (requirement) =>
          Object.keys(requirement).length <= 1 &&
          Object.keys(requirement).every((scheme) => scheme === "apiKey" || scheme === "oauth")
      );

      if (!supportedAuth) {
        throw new Error(
          `Unsupported authentication in ${command.id}. Browser-only operations must not be exposed by the CLI.`
        );
      }

      const flags = new Set<string>();
      const fields = new Set<string>();
      const addField = (field: Omit<APIField, "kind" | "nullable" | "flag">) => {
        const schema = resolve(field.schema);
        const alternatives = schema.anyOf ?? schema.oneOf ?? [schema];
        const nullable = alternatives.some((item) => item.type === "null");
        const values = alternatives.filter((item) => item.type !== "null");
        const value = values.length === 1 ? resolve(values[0]) : {};
        const type = value.type ?? ("const" in value ? typeof value.const : undefined);
        const binary = Boolean(value.contentMediaType || value.format === "binary");
        const kind = binary
          ? "file"
          : type === "integer" || type === "number"
            ? "number"
            : type === "boolean"
              ? "boolean"
              : type === "string"
                ? "string"
                : "json";
        const flag = kebab(field.name);

        if (reserved.has(flag) || flags.has(flag) || fields.has(field.name)) {
          throw new Error(`Conflicting CLI field: ${command.id}.${field.name}`);
        }

        if (binary && field.location !== "body") {
          throw new Error(`Unsupported binary parameter: ${command.id}.${field.name}`);
        }

        fields.add(field.name);
        flags.add(flag);
        collectSchemas(field.schema);
        command.fields.push({ ...field, flag, kind, nullable });
      };

      if (names.has(key) || ids.has(command.id)) throw new Error(`Duplicate CLI operation: ${key}`);
      names.add(key);
      ids.add(command.id);

      for (const parameter of operation.parameters ?? []) {
        if (!["path", "query", "header"].includes(parameter.in) || !parameter.schema) {
          throw new Error(`Unsupported parameter in ${command.id}`);
        }

        if (parameter.in === "header" && parameter.name !== "x-workspace-id") {
          throw new Error(`Header requires explicit SDK support: ${parameter.name}`);
        }

        addField({
          name: parameter.name,
          location: parameter.in,
          required: Boolean(parameter.required),
          schema: {
            ...parameter.schema,
            description: parameter.description ?? parameter.schema.description
          }
        });
      }

      const content = operation.requestBody?.content;

      if (content) {
        if (
          Object.keys(content).some(
            (type) => !["application/json", "multipart/form-data"].includes(type)
          )
        ) {
          throw new Error(`Unsupported body in ${command.id}`);
        }

        const schema = resolve(
          (content["multipart/form-data"] ?? content["application/json"]).schema ?? {}
        );

        if (
          schema.type !== "object" ||
          schema.oneOf ||
          schema.anyOf ||
          schema.allOf ||
          schema.additionalProperties
        ) {
          throw new Error(`Unsupported root body schema in ${command.id}`);
        }

        for (const [name, property] of Object.entries(schema.properties ?? {}))
          addField({
            name,
            location: "body",
            required: schema.required?.includes(name) ?? false,
            schema: property
          });
      }

      const kinds = new Set<APICommand["response"]>();

      for (const [status, response] of Object.entries(operation.responses)) {
        if (!/^2\d\d$/.test(status)) continue;

        for (const [type, media] of Object.entries(response.content ?? {})) {
          if (media.schema && empty(media.schema)) continue;

          kinds.add(
            type === "text/event-stream"
              ? "stream"
              : type === "application/json"
                ? "json"
                : "binary"
          );
          const schema = media.schema ? resolve(media.schema) : {};
          const pagination = schema.properties?.pagination;

          if (method === "get" && fields.has("cursor") && pagination && schema.properties?.data) {
            command.pagination = fields.has("snapshotID") ? "snapshot" : "cursor";
          }
        }
      }

      if (kinds.size > 1) throw new Error(`Mixed response kinds in ${command.id}`);

      const unsupportedSnapshotPagination =
        command.pagination === "snapshot" &&
        !["content.listCollections", "content.listEntries"].includes(command.id);

      if (unsupportedSnapshotPagination) {
        throw new Error(`Snapshot pagination requires an SDK iterator binding: ${command.id}`);
      }

      command.response = [...kinds][0] ?? "empty";
      commands.push(command);
    }
  }

  commands.sort((a, b) => a.id.localeCompare(b.id));

  const manifest = `/* eslint-disable max-lines */
// Generated from SDK openapi.json. Do not edit.\nimport type { APICommand, JSONSchema } from "./types";\n\nconst commands: APICommand[] = ${JSON.stringify(commands, null, 2)};\nconst schemas: Record<string, JSONSchema> = ${JSON.stringify(schemas, null, 2)};\nexport { commands, schemas };\n`;
  const bindings = `// Generated from SDK openapi.json. Do not edit.\nimport type { operations, OperationInput } from "@andesine/sdk";\nimport type { SDKOperation } from "./types";\n\nconst bindings: Record<keyof operations, SDKOperation> = {\n${commands.map((command) => `${JSON.stringify(command.id)}: (client, input, options) => client.${command.id}(input as OperationInput<${JSON.stringify(command.id)}>, options)`).join(",\n")}\n};\nexport { bindings };\n`;

  const formatting = {
    ...(await resolveConfig(new URL("package.json", root).pathname)),
    parser: "typescript"
  };

  await writeFile(new URL("src/api/manifest.ts", root), await format(manifest, formatting));
  await writeFile(new URL("src/api/bindings.ts", root), await format(bindings, formatting));
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await generateAPI();

export { generateAPI };
