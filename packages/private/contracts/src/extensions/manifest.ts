import * as z from "zod";
import { keyPermissionType } from "../entities/keys";
import { hasPermission } from "../permissions/requirements";
import { webhookEventDefinitions } from "../webhooks/catalog-definitions";
import { uniqueItems } from "../webhooks/events";
import { extensionConfigurationType } from "./configuration";
import {
  extensionContributionsType,
  extensionIconType,
  extensionStableIDType
} from "./contributions";
import { MAX_EXTENSION_WEBHOOKS, extensionWebhookType } from "./webhooks";

type ExtensionPermission = z.output<typeof extensionPermissionType>;
type ExtensionBackendKey = z.output<typeof extensionBackendKeyType>;
type ExtensionManifest = z.output<typeof extensionManifestType>;
type ExtensionManifestInput = z.input<typeof extensionManifestType>;

const EXTENSION_API_VERSION = 1;
const MAX_EXTENSION_REQUEST_URLS = 10;
const MAX_EXTENSION_BACKEND_KEYS = 3;
/** Approving it requires workspace-wide restricted-content read authority. */
const RESTRICTED_CONTENT_PERMISSION = "read:restricted_collections";
const extensionPermissionType = z.enum([
  ...keyPermissionType.options,
  RESTRICTED_CONTENT_PERMISSION
]);
const extensionNameType = z
  .string()
  .regex(/^[a-z\d][a-z\d-]{0,38}\/[a-z\d][a-z\d-]{0,62}$/, "Use scope/name, e.g. acme/publish");
const extensionVersionType = z
  .string()
  .max(64)
  .regex(
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?$/,
    "Use a semantic version without build metadata, e.g. 1.4.0"
  );
const base64URLType = z.string().regex(/^[A-Za-z\d_-]{43}$/, "Use a base64url 32-byte value");
const extensionBackendKeyIDType = z.string().regex(/^[A-Za-z\d._-]{1,64}$/, "Use a key ID");
/** Public JWKs only; strict objects reject private key members. */
const extensionBackendKeyType = z.discriminatedUnion("alg", [
  z.strictObject({
    kid: extensionBackendKeyIDType,
    kty: z.literal("OKP"),
    alg: z.literal("EdDSA"),
    crv: z.literal("Ed25519"),
    x: base64URLType
  }),
  z.strictObject({
    kid: extensionBackendKeyIDType,
    kty: z.literal("EC"),
    alg: z.literal("ES256"),
    crv: z.literal("P-256"),
    x: base64URLType,
    y: base64URLType
  })
]);
/** Canonical URL with an optional path prefix and no credentials, query, or fragment. */
const createURLType = (protocols: string[]): z.ZodString => {
  return z
    .string()
    .max(2048)
    .refine(
      (value) => {
        if (!URL.canParse(value)) return false;

        const url = new URL(value);
        const isCanonical = value === url.href || (url.pathname === "/" && value === url.origin);
        const hasExtraParts = url.username || url.password || url.search || url.hash;

        return protocols.includes(url.protocol) && isCanonical && !hasExtraParts;
      },
      `Use a canonical ${protocols.join(" or ")} URL, e.g. https://api.example.com/v1/`
    );
};
const createManifestType = (protocols: string[]) => {
  const urlType = createURLType(protocols);

  return z
    .strictObject({
      name: extensionNameType,
      version: extensionVersionType,
      displayName: z.string().min(1).max(60),
      description: z.string().min(1).max(300),
      /** The logo or main icon, shown in the catalog, extension list, and settings. */
      icon: extensionIconType.optional(),
      apiVersion: z.literal(EXTENSION_API_VERSION),
      permissions: z
        .array(extensionPermissionType)
        .refine(uniqueItems, "Permissions must be unique")
        .default([]),
      requests: z
        .array(urlType)
        .max(MAX_EXTENSION_REQUEST_URLS)
        .refine(uniqueItems, "Request URLs must be unique")
        .describe("URLs that the frontend can request, besides the backend")
        .default([]),
      backend: z
        .strictObject({
          url: urlType,
          keys: z
            .array(extensionBackendKeyType)
            .min(1)
            .max(MAX_EXTENSION_BACKEND_KEYS)
            .refine((keys) => uniqueItems(keys.map(({ kid }) => kid)), "Key IDs must be unique")
        })
        .optional(),
      webhooks: z
        .record(extensionStableIDType, extensionWebhookType)
        .refine(
          (webhooks) => Object.keys(webhooks).length <= MAX_EXTENSION_WEBHOOKS,
          `Use at most ${MAX_EXTENSION_WEBHOOKS} webhooks`
        )
        .default({}),
      configuration: extensionConfigurationType.optional(),
      ...extensionContributionsType
    })
    .superRefine((manifest, context) => {
      const contributionIDs = [
        ...manifest.elementViews,
        ...manifest.blockActions,
        ...manifest.panels
      ].map(({ id }) => id);
      const isGranted = (required: string): boolean => {
        return manifest.permissions.some((permission) => hasPermission(permission, required));
      };
      const readsRestrictableContent = isGranted("read:entries") || isGranted("read:collections");
      const hasUnusedRestrictedGrant =
        manifest.permissions.includes(RESTRICTED_CONTENT_PERMISSION) && !readsRestrictableContent;

      if (!uniqueItems(contributionIDs)) {
        context.addIssue({ code: "custom", message: "Contribution IDs must be unique" });
      }

      if (hasUnusedRestrictedGrant) {
        context.addIssue({
          code: "custom",
          path: ["permissions"],
          message: "Restricted content needs read:entries or read:collections"
        });
      }

      for (const [id, webhook] of Object.entries(manifest.webhooks)) {
        if (!manifest.backend) {
          context.addIssue({
            code: "custom",
            path: ["webhooks", id],
            message: "Webhooks need a backend"
          });
        }

        for (const [index, event] of webhook.events.entries()) {
          const definition = webhookEventDefinitions[event as keyof typeof webhookEventDefinitions];
          const missing = definition?.requiredPermissions.filter(
            (required) => !isGranted(required)
          );

          if (missing?.length) {
            context.addIssue({
              code: "custom",
              path: ["webhooks", id, "events", index],
              message: `The event needs ${missing.join(", ")}`
            });
          }
        }
      }
    });
};
const extensionURLType = createURLType(["https:"]);
const extensionManifestType = createManifestType(["https:"]);
/** Development extensions run on a fully local stack, so their URLs can use HTTP. */
const developmentExtensionManifestType = createManifestType(["https:", "http:"]);

export {
  EXTENSION_API_VERSION,
  RESTRICTED_CONTENT_PERMISSION,
  extensionPermissionType,
  extensionNameType,
  extensionVersionType,
  extensionBackendKeyIDType,
  extensionBackendKeyType,
  extensionURLType,
  extensionManifestType,
  developmentExtensionManifestType
};
export type { ExtensionPermission, ExtensionBackendKey, ExtensionManifest, ExtensionManifestInput };
