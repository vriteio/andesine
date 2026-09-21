import * as z from "zod";

const nonemptyString = z.string().trim().min(1);
const workspaceIDSchema = z
  .string()
  .regex(/^ws_[A-Za-z\d]{1,22}$/, "Expected a workspace ID (ws_…).");
const sourceSchema = z.union([
  z.strictObject({
    kind: z.literal("published"),
    channel: nonemptyString.max(50).default("published")
  }),
  z.strictObject({
    kind: z.literal("published"),
    snapshotID: z.string().regex(/^snp_[A-Za-z\d]{1,22}$/)
  }),
  z.strictObject({ kind: z.literal("current") })
]);
const typesConfigSchema = z.strictObject({
  source: sourceSchema.default({ kind: "published", channel: "published" }),
  collections: z
    .array(nonemptyString)
    .default([])
    .describe("Collection IDs or paths; empty selects all accessible collections."),
  output: nonemptyString
    .default("src/andesine.generated.ts")
    .describe(
      "Output path relative to andesine.json, or the working directory when no config is present."
    ),
  includeEntryIDs: z.boolean().default(false),
  includeEntryPaths: z.boolean().default(false),
  includeTree: z.boolean().default(false)
});
const projectConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  version: z.literal(1),
  baseURL: z
    .url()
    .optional()
    .describe(
      "HTTP(S) API root, optionally including a deployment prefix. No credentials, query, or fragment."
    ),
  workspaceID: workspaceIDSchema.optional(),
  profile: nonemptyString.optional(),
  types: typesConfigSchema.optional()
});
const profileSchema = z.strictObject({
  baseURL: z.url(),
  workspaceID: workspaceIDSchema.optional(),
  accountID: nonemptyString.optional(),
  credentialRef: nonemptyString.optional()
});
const userConfigSchema = z.strictObject({
  version: z.literal(1),
  defaultProfile: nonemptyString.optional(),
  profiles: z.record(nonemptyString, profileSchema)
});

type ProjectConfig = z.output<typeof projectConfigSchema>;
type TypesConfig = z.output<typeof typesConfigSchema>;
type UserProfile = z.output<typeof profileSchema>;

export { projectConfigSchema, typesConfigSchema, userConfigSchema, workspaceIDSchema };
export type { ProjectConfig, TypesConfig, UserProfile };
