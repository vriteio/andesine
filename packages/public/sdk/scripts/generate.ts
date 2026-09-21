import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
import { format, resolveConfig } from "prettier";
import openapiTS, {
  astToString,
  type OpenAPI3,
  type Method,
  type MediaTypeObject
} from "openapi-typescript";

const root = new URL("../", import.meta.url);
const document: OpenAPI3 = JSON.parse(await readFile(new URL("openapi.json", root), "utf8"));
const ast = await openapiTS(document, {
  rootTypes: true,
  rootTypesNoSchemaPrefix: true,
  rootTypesKeepCasing: true,
  defaultNonNullable: false,
  transform(schema) {
    if (("contentMediaType" in schema && schema.contentMediaType) || schema.format === "binary") {
      return ts.factory.createTypeReferenceNode("Blob");
    }
  },
  postTransform(_type, { path, ctx }) {
    if (!path || !/\/responses\/[^/]+\/content\/[^/]+$/.test(path)) return;

    const schema = ctx.resolve<MediaTypeObject>(path)?.schema;
    const alternatives = schema && "anyOf" in schema ? schema.anyOf : [schema];
    const isEmptyResponse =
      alternatives?.length &&
      alternatives.every((alternative) => {
        const excluded = alternative && "not" in alternative ? alternative.not : undefined;

        return excluded && typeof excluded === "object" && Object.keys(excluded).length === 0;
      });

    // oRPC uses impossible schemas for undefined bodies. The normal transform
    // hook skips these schemas because they have no `type` property.
    if (isEmptyResponse) return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
  }
});
const resources = new Map<string, string[]>();
const resourceTypes = new Map<string, string[]>();
const schemaNames = Object.keys(document.components?.schemas || {}).sort();
const typeNames = new Set<string>();
const operationTypes: string[] = [];
const httpMethods: string[] = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
const formatting = {
  ...(await resolveConfig(new URL("package.json", root).pathname)),
  parser: "typescript"
};
const header = "// Generated from openapi.json. Do not edit.\n";

const registerTypeName = (name: string): void => {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    throw new Error(`Invalid public type name: ${name}`);
  }

  if (typeNames.has(name)) {
    throw new Error(`Duplicate public type name: ${name}`);
  }

  typeNames.add(name);
};

schemaNames.forEach(registerTypeName);

for (const [path, item] of Object.entries(document.paths || {})) {
  if ("$ref" in item) continue;

  for (const method of Object.keys(item)) {
    if (!httpMethods.includes(method)) continue;

    const operation = item[method as Method];

    if (!operation || "$ref" in operation || !operation.operationId) continue;

    const [resource, name] = operation.operationId.split(".");
    const typeName = operation.operationId
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    const requestBody = operation.requestBody;
    const content = requestBody && "content" in requestBody ? requestBody.content : undefined;
    const body = content?.["multipart/form-data"] || content?.["application/json"];
    const parameters = (operation.parameters || []).filter((parameter) => "in" in parameter);
    const example = (operation as typeof operation & { "x-sdk-example"?: Record<string, unknown> })[
      "x-sdk-example"
    ];
    const exampleCode = example
      ? JSON.stringify(example, null, 2).replace(
          '"<binary file>"',
          'new Blob([imageBytes], { type: "image/png" })'
        )
      : undefined;
    const documentation = [
      operation.summary,
      operation.description,
      exampleCode ? `@example\nawait client.${operation.operationId}(${exampleCode});` : undefined
    ]
      .filter(Boolean)
      .join("\n\n")
      .replaceAll("*/", "*\\/");
    const comment = `/**\n${documentation
      .split("\n")
      .map((line) => ` * ${line}`)
      .join("\n")}\n */\n`;
    const streaming = Object.values(operation.responses || {}).some((response) => {
      return "content" in response && Boolean(response.content?.["text/event-stream"]);
    });
    const definition = {
      ...(streaming && { streaming: true }),
      method,
      path,
      pathParams: parameters
        .filter((parameter) => parameter.in === "path")
        .map((parameter) => parameter.name),
      queryParams: parameters
        .filter((parameter) => parameter.in === "query")
        .map((parameter) => parameter.name),
      body: Boolean(body),
      multipart: Boolean(content?.["multipart/form-data"]),
      binary: Object.values(operation.responses || {}).some((response) =>
        Object.keys(("content" in response && response.content) || {}).some((type) => {
          return type !== "application/json" && type !== "text/event-stream";
        })
      ),
      anonymous: operation.security?.length === 0
    };

    for (const direction of ["Input", "Output", "Error"]) {
      const alias = `${typeName}${direction}`;

      registerTypeName(alias);
      operationTypes.push(
        `export type ${alias} = Operation${direction}<${JSON.stringify(operation.operationId)}>;`
      );
    }

    if (!resources.has(resource)) resources.set(resource, []);
    if (!resourceTypes.has(resource)) resourceTypes.set(resource, []);
    resourceTypes
      .get(resource)!
      .push(
        `${comment}${JSON.stringify(name)}: Operation<${JSON.stringify(operation.operationId)}, Workspace>;`
      );
    resources
      .get(resource)!
      .push(
        `${JSON.stringify(name)}: operation<${JSON.stringify(operation.operationId)}, Workspace>(request, ${JSON.stringify(definition)})`
      );
  }
}

await writeFile(
  new URL("src/generated/schema.ts", root),
  await format("/* eslint-disable max-lines */\n" + header + astToString(ast), formatting)
);
await writeFile(
  new URL("src/generated/types.ts", root),
  await format(
    header +
      `import type { OperationInput, OperationOutput, OperationError } from "../operation";\n\n` +
      `export type { ${schemaNames.join(", ")} } from "./schema";\n\n` +
      operationTypes.sort().join("\n"),
    formatting
  )
);
await writeFile(
  new URL("src/generated/resources.ts", root),
  await format(
    "/* eslint-disable max-lines */\n" +
      header +
      `import { operation, type Operation, type Requester } from "../operation";\nimport type { WorkspaceTypeMap } from "../workspace";\n\ninterface APIResources<Workspace extends WorkspaceTypeMap = WorkspaceTypeMap> {\n${[...resourceTypes].map(([name, methods]) => `${JSON.stringify(name)}: {\n${methods.join("\n")}\n}`).join("\n")}\n}\n\nconst createResources = <Workspace extends WorkspaceTypeMap = WorkspaceTypeMap>(request: Requester): APIResources<Workspace> => ({\n${[...resources].map(([name, methods]) => `${JSON.stringify(name)}: {\n${methods.join(",\n")}\n}`).join(",\n")}\n});\n\nexport { createResources };\nexport type { APIResources };\n`,
    formatting
  )
);
