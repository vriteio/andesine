import { z } from "astro/zod";

const fileSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    /** Replaces the path from the file location, relative to the source mount. */
    slug: z.string().trim().optional(),
    navigationLabel: z.string().trim().min(1).optional(),
    navigationHidden: z.boolean().default(false),
    searchHidden: z.boolean().default(false),
    /** Lower numbers come first. Items with the same order sort by path. */
    order: z.number().default(0),
    toc: z.boolean().default(true),
    layout: z.enum(["docs", "wide"]).default("docs"),
    /** The date of the last change, e.g. `2026-09-27`, for the page footer and the sitemap. */
    updatedAt: z.coerce.date().optional()
  })
  .strict();

type FileMetadata = z.output<typeof fileSchema>;

export { fileSchema };
export type { FileMetadata };
