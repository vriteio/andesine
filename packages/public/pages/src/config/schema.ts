import { z } from "zod";

const identifierSchema = z
  .string()
  .regex(/^[a-z][\w-]*$/, "Use lowercase letters, digits, - or _.");
const iconSchema = z.string().regex(/^i-[\w-]+:[\w-]+$/, "Use an icon class, e.g. i-lucide:book.");
const pathSchema = z.string().regex(/^\/(?:.*\/)?$/, "Use a path that starts and ends with /.");
// Base-prefixed URLs join the base as is, so it cannot need encoding.
const baseSchema = pathSchema.refine(
  (path) => path.split("/").every((segment) => encodeURIComponent(segment) === segment),
  "Use a base path with letters, digits, -, _, ., !, ~, *, ', ( and ) only."
);
const linkSchema = z
  .object({ label: z.string().min(1), href: z.string().min(1), icon: iconSchema.optional() })
  .strict();
const iconLinkSchema = z
  .object({ label: z.string().min(1), href: z.string().min(1), icon: iconSchema })
  .strict();
const logoSchema = z
  .object({
    src: z.string().min(1),
    /** A square mark next to the site name, or a full wordmark before it. */
    format: z.enum(["icon", "full"]).default("icon"),
    /** The text in a full logo, for screen readers, e.g. "Andesine". */
    alt: z.string().min(1).optional(),
    /** Shows the site name after the logo. */
    title: z.boolean().default(true)
  })
  .strict();
const brandSchema = z
  .object({
    primary: z.string().min(1).default("#ff3617"),
    secondary: z.string().min(1).default("#f88f52"),
    tertiary: z.string().min(1).default("#fc6335")
  })
  .strict();
const pageActionsSchema = z
  .object({
    /** AI chat services that open with the page's Markdown as context. */
    openIn: z.array(z.enum(["chatgpt", "claude", "perplexity"])).default(["chatgpt", "claude"])
  })
  .strict();
const agentsSchema = z
  .object({
    /** Site-wide guidance for AI agents, in the Markdown pages, `llms.txt`, and `llms-full.txt`. */
    instructions: z.string().trim().min(1).optional(),
    /** Path to your own `SKILL.md`, relative to the config. It replaces the generated skill. */
    skill: z
      .string()
      .regex(/^\.\.?\//, "Use a path relative to the config, e.g. ./SKILL.md.")
      .optional()
  })
  .strict();
const socialSchema = z
  .object({
    /** The image for link previews when pages have no generated image. */
    image: z.string().min(1).optional(),
    /** Generates an image for each page with the template's social card. */
    generate: z.boolean().default(true),
    /** Background image of generated cards. */
    background: z.string().min(1).optional()
  })
  .strict();
const sectionSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1),
    icon: iconSchema.optional(),
    sources: z.array(identifierSchema).min(1),
    /** Links at the top of the navigation on this section's pages, after the site's links. */
    links: z.array(iconLinkSchema).default([])
  })
  .strict();
const filesSourceSchema = z
  .object({
    id: identifierSchema,
    type: z.literal("files"),
    directory: z.string().min(1),
    mount: pathSchema.default("/")
  })
  .strict();
const andesineSourceSchema = z
  .object({
    id: identifierSchema,
    type: z.literal("andesine"),
    /** ID of the published collection. The build reads its latest publication. */
    collection: z.string().min(1),
    mount: pathSchema.default("/"),
    apiURL: z.url({ protocol: /^https?$/ }).optional(),
    /** Name of the environment variable with the API key. The key itself is never in config. */
    apiKeyEnv: z.string().min(1).default("ANDESINE_API_KEY"),
    /** AI answers in search. The API key needs the `ai-answers` permission. */
    answers: z.boolean().default(true)
  })
  .strict();
const openAPISourceSchema = z
  .object({
    id: identifierSchema,
    type: z.literal("openapi"),
    /** An OpenAPI 3.0 or 3.1 file, relative to the project root, or an HTTPS URL. */
    spec: z.string().min(1),
    mount: pathSchema.default("/"),
    /** Makes a landing page for each tag with a description. Without it, tags only group pages. */
    tagPages: z.boolean().default(true)
  })
  .strict();
const sourceSchema = z.discriminatedUnion("type", [
  filesSourceSchema,
  andesineSourceSchema,
  openAPISourceSchema
]);
const configSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    site: z.url({ protocol: /^https?$/ }),
    base: baseSchema.default("/"),
    language: z.string().min(2).default("en"),
    logo: logoSchema.optional(),
    favicon: z.string().min(1).optional(),
    brand: brandSchema.prefault({}),
    /** Icon links at the top of the navigation, e.g. to a changelog or a community. */
    links: z.array(iconLinkSchema).default([]),
    cta: linkSchema.optional(),
    /** Icon links in the footer, e.g. to GitHub or Discord. */
    socialLinks: z.array(iconLinkSchema).default([]),
    sections: z.array(sectionSchema).default([]),
    /** Shows sections as tabs in the header, or as links at the top of the navigation. */
    sectionsDisplay: z.enum(["tabs", "navigation"]).default("tabs"),
    sources: z.array(sourceSchema).default([]),
    /** The page actions menu; `false` hides it. Markdown pages exist either way. */
    pageActions: z.union([z.literal(false), pageActionsSchema]).prefault({}),
    agents: agentsSchema.prefault({}),
    social: socialSchema.prefault({})
  })
  .strict()
  .superRefine((config, context) => {
    const sourceIDs = new Set<string>();
    const sectionSources = new Map<string, string>();

    config.sources.forEach((source, index) => {
      if (sourceIDs.has(source.id)) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "id"],
          message: `Source ID "${source.id}" is not unique.`
        });
      }

      sourceIDs.add(source.id);
    });

    config.sections.forEach((section, index) => {
      section.sources.forEach((sourceID, sourceIndex) => {
        const path = ["sections", index, "sources", sourceIndex];
        const owner = sectionSources.get(sourceID);

        if (!sourceIDs.has(sourceID)) {
          context.addIssue({
            code: "custom",
            path,
            message: `Source "${sourceID}" does not exist.`
          });
        }

        if (owner) {
          context.addIssue({
            code: "custom",
            path,
            message: `Source "${sourceID}" is already in section "${owner}".`
          });
        }

        sectionSources.set(sourceID, section.id);
      });
    });

    if (!config.sections.length) return;

    config.sources.forEach((source, index) => {
      if (sectionSources.has(source.id)) return;

      context.addIssue({
        code: "custom",
        path: ["sources", index, "id"],
        message: `Source "${source.id}" is not in a section.`
      });
    });
  });

type PagesConfigInput = z.input<typeof configSchema>;
type PagesConfig = z.output<typeof configSchema>;
type SourceConfig = PagesConfig["sources"][number];
type FilesSourceConfig = Extract<SourceConfig, { type: "files" }>;
type AndesineSourceConfig = Extract<SourceConfig, { type: "andesine" }>;
type OpenAPISourceConfig = Extract<SourceConfig, { type: "openapi" }>;
type SectionConfig = PagesConfig["sections"][number];
type LinkConfig = z.output<typeof linkSchema>;
type IconLinkConfig = PagesConfig["links"][number];
type AIService = z.output<typeof pageActionsSchema>["openIn"][number];

export { configSchema };
export type {
  PagesConfigInput,
  PagesConfig,
  SourceConfig,
  FilesSourceConfig,
  AndesineSourceConfig,
  OpenAPISourceConfig,
  SectionConfig,
  LinkConfig,
  IconLinkConfig,
  AIService
};
