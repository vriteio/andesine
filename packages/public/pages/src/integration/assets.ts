import { copyFile, mkdir, readFile } from "node:fs/promises";
import type { ViteDevServer } from "vite";
import { assetFile, assetPath, getAssetPrefix, mimeTypes } from "../sources/andesine/assets";

const readFileList = async (directory: URL): Promise<string[]> => {
  const files: unknown = JSON.parse(await readFile(new URL("files.json", directory), "utf8"));

  return Array.isArray(files) ? files.filter((file) => assetFile.test(String(file))) : [];
};
/** Copies the cached images of build-time Andesine sources into the build output. */
const copyAssets = async (cache: URL, output: URL, sourceIDs: string[]): Promise<void> => {
  const destination = new URL(`${assetPath}/`, output);

  if (!sourceIDs.length) return;

  await mkdir(destination, { recursive: true });

  for (const sourceID of sourceIDs) {
    const directory = new URL(`andesine/${sourceID}/`, cache);

    for (const file of await readFileList(directory)) {
      await copyFile(new URL(file, directory), new URL(file, destination));
    }
  }
};
/** Serves the cached images in development. */
const serveAssets = (
  server: ViteDevServer,
  cache: URL,
  base: string,
  sourceIDs: string[]
): void => {
  const prefix = getAssetPrefix(base);

  server.middlewares.use(async (request, response, next) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const file = path.slice(prefix.length);

    if (!path.startsWith(prefix) || !assetFile.test(file)) return next();

    for (const sourceID of sourceIDs) {
      const bytes = await readFile(new URL(`andesine/${sourceID}/${file}`, cache)).catch(
        () => null
      );

      if (!bytes) continue;

      response.setHeader(
        "Content-Type",
        mimeTypes[file.split(".").at(-1) as keyof typeof mimeTypes]
      );
      response.end(bytes);

      return;
    }

    next();
  });
};

export { copyAssets, serveAssets };
