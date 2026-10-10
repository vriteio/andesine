import { API_VERSION } from "../limits";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { publicSchemas } from "./schemas/public";
import { isPublicAPI, type ORPCMeta } from "./base";
import { type APIContract } from "./index";

const generateOpenAPI = async (contract: APIContract, baseURL: string) => {
  const metadata = new Map<string, ORPCMeta>();
  const document = await new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter({ maxStructureDepth: 50 })]
  }).generate(contract, {
    filter: ({ contract, path }) => {
      const meta = contract["~orpc"].meta;
      const name = path.join(".");
      const isPublic = (isPublicAPI(meta) && !meta.cli) || name === "content.getAsset";

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
    security: [{ apiKey: [] }, { oauth: [] }],
    components: {
      securitySchemes: {
        oauth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Andesine OAuth access token",
          description:
            "Use an OAuth access token with andesine:api scope. Send x-workspace-id for workspace operations. Current user permissions apply."
        },
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Andesine API key",
          description: "Use an Andesine API key as a Bearer token"
        },
        extensionToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "An extension JWT signed with the extension's registered key: iss is the registry name, sub the ext_ ID (omitted for app-level operations), aud the instance API URL, and exp at most 5 minutes after iat."
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
      const required = meta?.required;
      const oauthOnly = required && required !== true && required.oauth && !required.key;
      const extensionOnly = required && required !== true && required.extension;

      if (oauthOnly) operation.security = [{ oauth: [] }];

      if (extensionOnly) operation.security = [{ extensionToken: [] }];

      if (meta?.requireWorkspace !== false && operation.operationId !== "content.getAsset") {
        operation.parameters = [
          ...(operation.parameters || []),
          {
            name: "x-workspace-id",
            in: "header",
            required: false,
            schema: { type: "string" },
            description:
              "Required for OAuth: ID of the workspace to access. API keys use their own workspace."
          }
        ];
      }

      if (Array.isArray(permissions)) {
        operation.description = [
          operation.description,
          `Required API key permissions: ${permissions.join(", ")}. Write permissions also grant read access for the same resource.`
        ]
          .filter(Boolean)
          .join("\n\n");
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
