import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";
import type { Plugin } from "rolldown";
import type { OpenAPI3, SchemaObject, ReferenceObject } from "openapi-typescript";

const WEBHOOK_VALIDATOR_MODULE = "virtual:andesine-webhook-validator";
const compileWebhookValidator = (document: OpenAPI3): string => {
  const schema = document.components?.schemas?.WebhookEvent;
  const ajv = new Ajv2020({
    code: { source: true, esm: true },
    strict: false,
    discriminator: true,
    messages: false,
    loopRequired: 1,
    inlineRefs: false
  });

  if (!schema || "$ref" in schema || !schema.anyOf) {
    throw new Error("Public webhook schemas are missing");
  }

  addFormats(ajv, ["date-time"]);

  const definitions: Record<string, SchemaObject | ReferenceObject> = {};
  const shared = new Map<string, string>();
  const branches = schema.anyOf.map((branch) => {
    if (!("properties" in branch) || !branch.properties) {
      throw new Error("Expected a webhook event object");
    }

    const properties = Object.fromEntries(
      Object.entries(branch.properties).map(([name, value]) => {
        if (name === "type") return [name, value];

        const key = JSON.stringify(value);
        const id = shared.get(key) ?? `field${shared.size}`;

        shared.set(key, id);
        definitions[id] = value;
        return [name, { $ref: `#/$defs/${id}` }];
      })
    );

    return { ...branch, properties };
  });

  // Reuse common envelope/subject validators instead of inlining them for every event.
  // Event types are disjoint constants. Dispatch directly to the matching branch.
  ajv.addSchema(
    {
      ...schema,
      anyOf: undefined,
      type: "object",
      required: ["type"],
      $defs: definitions,
      oneOf: branches,
      discriminator: { propertyName: "type" }
    },
    "andesine:webhook-event"
  );

  return standaloneCode(ajv, { validateWebhookEvent: "andesine:webhook-event" });
};
const webhookValidatorPlugin = (root: string): Plugin => {
  const schemaPath = path.join(root, "openapi.json");
  const modulePath = path.join(root, "src/webhooks/validator.virtual.js");
  const require = createRequire(path.join(root, "package.json"));

  return {
    name: "webhook-validator",
    resolveId(id) {
      if (id === WEBHOOK_VALIDATOR_MODULE) return modulePath;
    },
    async load(id) {
      if (id !== modulePath) return;

      this.addWatchFile(schemaPath);

      const document: OpenAPI3 = JSON.parse(await readFile(schemaPath, "utf8"));

      return compileWebhookValidator(document);
    },
    async generateBundle(_options, bundle) {
      const pending = bundle["webhooks.js"] ? ["webhooks.js"] : [];
      const checked = new Set<string>();

      for (const name of pending) {
        if (checked.has(name)) continue;

        const chunk = bundle[name];

        if (chunk?.type !== "chunk" || chunk.dynamicImports.length) {
          throw new Error(`Webhook validation has an external or dynamic runtime import: ${name}`);
        }

        checked.add(name);
        pending.push(...chunk.imports);
      }

      if (!bundle["webhooks.js"]) return;

      const licenses = await Promise.all(
        ["ajv", "ajv-formats"].map(async (name) => {
          const licensePath = path.join(
            path.dirname(require.resolve(`${name}/package.json`)),
            "LICENSE"
          );

          this.addWatchFile(licensePath);

          return `${name}\n\n${await readFile(licensePath, "utf8")}`;
        })
      );

      this.emitFile({
        type: "asset",
        fileName: "THIRD_PARTY_LICENSES.txt",
        source: licenses.join("\n\n")
      });
    }
  };
};

export { webhookValidatorPlugin, WEBHOOK_VALIDATOR_MODULE };
