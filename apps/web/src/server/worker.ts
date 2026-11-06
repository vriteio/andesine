import { config } from "#web/lib/api/config";
import { render } from "#web/entry-server";

interface AssetsBinding {
  fetch(input: Request | URL | string): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
  /** The backend's ORIGIN_SECRET, which requests to the API must carry. */
  ORIGIN_SECRET?: string;
}

const NO_CACHE_FILES = new Set(["/service-worker.js", "/offline.html"]);
const API_ORIGIN = new URL(config.PUBLIC_API_URL).origin;
const globalFetch = globalThis.fetch;

let template: Promise<string> | null = null;
let originSecret: string | undefined;

const loadTemplate = (env: Env, url: URL): Promise<string> => {
  template ??= env.ASSETS.fetch(new URL("/index.html", url)).then(async (response) => {
    if (!response.ok) throw new Error(`SSR template missing (${response.status})`);

    return response.text();
  });
  template.catch(() => {
    template = null;
  });

  return template;
};
const serveAsset = async (request: Request, env: Env, pathname: string): Promise<Response> => {
  const response = await env.ASSETS.fetch(request);

  if (!NO_CACHE_FILES.has(pathname)) return response;

  const headers = new Headers(response.headers);

  headers.set("Cache-Control", "no-cache");

  return new Response(response.body, { status: response.status, headers });
};

// Requests to the API from SSR carry the origin secret, whether or not a Cloudflare rule adds it.
globalThis.fetch = (input, init) => {
  const request = new Request(input, init);

  if (!originSecret || new URL(request.url).origin !== API_ORIGIN) return globalFetch(request);

  request.headers.set("X-Origin-Secret", originSecret);

  return globalFetch(request);
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isPageRequest = request.method === "GET" || request.method === "HEAD";
    const isAsset = /\.[^/]+$/.test(url.pathname);

    originSecret = env.ORIGIN_SECRET;

    if (isAsset) return serveAsset(request, env, url.pathname);

    if (!isPageRequest) return new Response("Method Not Allowed", { status: 405 });

    try {
      return await render(request, await loadTemplate(env, url));
    } catch (error) {
      const reference = crypto.randomUUID();

      console.error("SSR render failed", { reference, error });

      return new Response(`Unable to render this page. Reference: ${reference}`, {
        status: 500,
        headers: { "Content-Type": "text/plain", "X-Request-ID": reference }
      });
    }
  }
};

export default worker;
