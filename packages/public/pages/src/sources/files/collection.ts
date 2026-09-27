import { defineCollection } from "astro/content/config";
import { glob } from "astro/loaders";
import type { FilesSourceConfig } from "../../config";
import { fileSchema } from "./schema";

const createFilesCollection = (source: FilesSourceConfig) => {
  return defineCollection({
    // Keep extensions in IDs, so `a.md` and `a.mdx` cannot replace each other.
    loader: glob({
      base: source.directory,
      pattern: "**/*.{md,mdx}",
      generateId: ({ entry }) => entry
    }),
    schema: fileSchema
  });
};

export { createFilesCollection };
