import { join } from "node:path";
import { createIndex, type CustomRecord, type PagefindIndex } from "pagefind";

const withIndex = async <T>(task: (index: PagefindIndex) => Promise<T>): Promise<T> => {
  const { index, errors } = await createIndex();

  if (!index) throw new Error(`Pagefind: ${errors.join(", ")}`);

  try {
    return await task(index);
  } finally {
    await index.deleteIndex();
  }
};
const assertNoErrors = (result: { errors: string[] }): void => {
  if (result.errors.length) throw new Error(`Pagefind: ${result.errors.join(", ")}`);
};
/**
 * Indexes the built pages that have a `data-pagefind-body` element, and writes the index to
 * `pagefind/` in the output directory.
 */
const writePagefindIndex = (directory: string): Promise<void> => {
  return withIndex(async (index) => {
    assertNoErrors(await index.addDirectory({ path: directory }));
    assertNoErrors(await index.writeFiles({ outputPath: join(directory, "pagefind") }));
  });
};
/** Creates index files in memory from records, for the development server. */
const createPagefindFiles = (records: CustomRecord[]): Promise<Map<string, Uint8Array>> => {
  return withIndex(async (index) => {
    for (const record of records) assertNoErrors(await index.addCustomRecord(record));

    const result = await index.getFiles();

    assertNoErrors(result);

    return new Map(result.files.map((file) => [file.path, file.content]));
  });
};

export { writePagefindIndex, createPagefindFiles };
