import { API_VERSION } from "#backend/lib/api/limits";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { publicSchemas } from "./schemas/public";
import type { ORPCMeta } from "./base";
import type { APIContract } from "./index";

const generateOpenAPI = async (contract: APIContract, baseURL: string) => {
  const metadata = new Map<string, ORPCMeta>();
  const document = await new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter({ maxStructureDepth: 50 })]
  }).generate(contract, {
    filter: ({ contract, path }) => {
      const meta = contract["~orpc"].meta;
      const name = path.join(".");
      const isPublic =
        Boolean(meta.required && meta.required !== true && meta.required.key) ||
        name === "content.getAsset";

      if (isPublic) metadata.set(name, meta);

      return isPublic;
    },
    commonSchemas: publicSchemas,
    info: {
      title: "Andesine API",
      version: API_VERSION,
      license: { name: "MIT", identifier: "MIT" }
    },
    servers: [{ url: baseURL }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Andesine API key",
          description: "Use an Andesine API key as a Bearer token"
        }
      }
    }
  });
  for (const item of Object.values(document.paths || {})) {
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      const operation = item?.[method];

      if (!operation) continue;

      const meta = metadata.get(operation.operationId || "");
      const permissions = meta?.required && meta.required !== true ? meta.required.key : undefined;
      const example = meta?.example;

      if (Array.isArray(permissions)) {
        operation.description += `\n\nRequired API key permissions: ${permissions.join(", ")}. Write permissions also grant read access for the same resource.`;
      }

      if (example) {
        Object.assign(operation, { "x-sdk-example": example });
        for (const parameter of operation.parameters || []) {
          if ("name" in parameter && parameter.name in example) {
            parameter.example = example[parameter.name];
          }
        }
        const body = operation.requestBody;
        if (body && "content" in body) {
          const parameterNames = new Set(
            (operation.parameters || []).flatMap((parameter) =>
              "name" in parameter ? [parameter.name] : []
            )
          );
          const bodyExample = Object.fromEntries(
            Object.entries(example).filter(([name]) => !parameterNames.has(name))
          );
          for (const media of Object.values(body.content)) media.example = bodyExample;
        }
      }
      if (operation.operationId === "content.getAsset") operation.security = [];
    }
  }
  return document;
};

export { generateOpenAPI };
