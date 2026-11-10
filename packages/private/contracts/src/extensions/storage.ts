import * as z from "zod";

/** Sizes are UTF-8 bytes; an entry's size is its key plus its JSON value. */
const extensionStorageLimits = {
  keyLength: 256,
  valueSize: 128 * 1024,
  totalSize: 10 * 1024 * 1024,
  entries: 10_000,
  pageEntries: 100,
  /** A list page ends before this size, so it fits in one protocol message. */
  pageSize: 192 * 1024
};
const extensionStorageKeyType = z
  .string()
  .min(1)
  .max(extensionStorageLimits.keyLength)
  .regex(/^\P{Cc}+$/u, "Keys cannot contain control characters");
const extensionStorageListInputType = z.object({
  prefix: z.string().max(extensionStorageLimits.keyLength).optional(),
  after: extensionStorageKeyType.optional().describe("Return entries after this key"),
  limit: z.coerce.number().int().min(1).max(extensionStorageLimits.pageEntries).default(100)
});

export { extensionStorageLimits, extensionStorageKeyType, extensionStorageListInputType };
