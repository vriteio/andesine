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

/** A folder's `meta.json`, in the Fumadocs format. Other Fumadocs keys are ignored. */
const metaSchema = z.object({
  /** The folder's navigation label. */
  title: z.string().trim().min(1).optional(),
  /** Child slugs (file names without extension, and folder names) in order. */
  pages: z.array(z.string().trim().min(1)).default([])
});

/** The name of the collection with the source's `meta.json` files. */
const toMetaCollection = (sourceID: string): string => `${sourceID}:meta`;

type FileMetadata = z.output<typeof fileSchema>;
type FolderMetadata = z.output<typeof metaSchema>;

export { fileSchema, metaSchema, toMetaCollection };
export type { FileMetadata, FolderMetadata };
