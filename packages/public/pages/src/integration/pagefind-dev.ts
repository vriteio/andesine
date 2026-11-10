import type { CustomRecord } from "pagefind";
import type { ViteDevServer } from "vite";
import { createPagefindFiles } from "../search/pagefind";

const contentTypes: Record<string, string> = { js: "text/javascript", json: "application/json" };

/**
 * Serves a Pagefind index in development. It is built in memory from the source records on the
 * first request, and again after a file changes.
 */
const servePagefind = (
  server: ViteDevServer,
  base: string,
  loadRecords: () => Promise<CustomRecord[]>
): void => {
  const prefix = `${base}pagefind/`;

  let files: Promise<Map<string, Uint8Array>> | undefined;

  server.watcher.on("all", () => (files = undefined));
  server.middlewares.use(async (request, response, next) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;

    if (!path.startsWith(prefix)) return next();

    files ??= loadRecords().then(createPagefindFiles);

    try {
      const body = (await files).get(path.slice(prefix.length));

      response.setHeader("Cache-Control", "no-store");
      response.statusCode = body ? 200 : 404;
      response.setHeader(
        "Content-Type",
        contentTypes[path.split(".").at(-1)!] ?? "application/octet-stream"
      );
      response.end(body);
    } catch (error) {
      files = undefined;
      server.config.logger.error(`Pagefind development index failed: ${String(error)}`);
      response.statusCode = 503;
      response.end();
    }
  });
};

export { servePagefind };
