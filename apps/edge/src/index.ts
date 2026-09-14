interface SessionResponse {
  session?: unknown;
  user?: {
    currentWorkspaceID?: string | null;
  };
}

interface Env {
  LANDING: Fetcher;
  DOCS: Fetcher;
  APP_ORIGIN: string;
  API_ORIGIN: string;
}

const SESSION_COOKIE_NAMES = new Set([
  "better-auth.session_token",
  "__Secure-better-auth.session_token"
]);
const LANDING_FILES = new Set([
  "/assets/noise.png",
  "/favicon.svg",
  "/jetbrains-mono-wghtOnly-normal.woff2",
  "/nunito-latin-ext-variable-wghtOnly-normal.woff2",
  "/nunito-latin-variable-wghtOnly-normal.woff2"
]);
const LANDING_PAGES = new Set(["/privacy", "/privacy/", "/tos", "/tos/"]);

const isPageRequest = (request: Request): boolean => {
  return request.method === "GET" || request.method === "HEAD";
};

const hasSessionCookie = (request: Request): boolean => {
  const cookieHeader = request.headers.get("cookie") || "";

  return cookieHeader.split(";").some((entry) => {
    const separator = entry.indexOf("=");
    const name = separator === -1 ? entry : entry.slice(0, separator);

    return SESSION_COOKIE_NAMES.has(name.trim());
  });
};

const readOrigin = (value: string): URL | null => {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    return url;
  } catch {
    return null;
  }
};

const getWorkspacePath = async (request: Request, env: Env): Promise<string | null> => {
  const apiOrigin = readOrigin(env.API_ORIGIN);

  if (!apiOrigin || !hasSessionCookie(request)) return null;

  const sessionURL = new URL("/auth/get-session", apiOrigin);

  try {
    const clientIP = request.headers.get("cf-connecting-ip");
    const headers = new Headers({
      accept: "application/json",
      cookie: request.headers.get("cookie") || ""
    });

    if (clientIP) headers.set("x-client-ip", clientIP);

    const response = await fetch(sessionURL, {
      headers,
      redirect: "manual"
    });

    if (!response.ok) return null;

    const data = await response.json<SessionResponse>();

    if (!data.session) return null;

    if (data.user?.currentWorkspaceID) {
      return `/${encodeURIComponent(data.user.currentWorkspaceID)}`;
    }

    return "/new-workspace";
  } catch {
    // Keep the public landing page available if the auth service is unavailable.
    return null;
  }
};

const serveLanding = async (request: Request, env: Env): Promise<Response> => {
  const assetURL = new URL("/", request.url);
  const assetResponse = await env.LANDING.fetch(assetURL);
  const headers = new Headers(assetResponse.headers);

  headers.set("cache-control", "private, no-store");
  headers.set("vary", "Cookie");

  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
};

const serveDocs = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);

  url.pathname = url.pathname.slice("/docs".length) || "/";
  const docsRequest = new Request(url, request);

  docsRequest.headers.delete("authorization");
  docsRequest.headers.delete("cookie");

  const response = await env.DOCS.fetch(docsRequest);
  const location = response.headers.get("location");

  if (!location) return response;

  const target = new URL(location, url);

  if (target.origin !== url.origin) return response;

  const hasDocsPrefix = target.pathname === "/docs" || target.pathname.startsWith("/docs/");
  const pathname = hasDocsPrefix ? target.pathname : `/docs${target.pathname}`;
  const headers = new Headers(response.headers);

  headers.set("location", `${pathname}${target.search}${target.hash}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

const rewriteAppLocation = (response: Response, appOrigin: URL): Response => {
  const location = response.headers.get("location");

  if (!location) return response;

  const target = new URL(location, appOrigin);

  if (target.origin !== appOrigin.origin) return response;

  const headers = new Headers(response.headers);

  headers.set("location", `${target.pathname}${target.search}${target.hash}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

const serveApp = async (request: Request, env: Env): Promise<Response> => {
  const appOrigin = readOrigin(env.APP_ORIGIN);

  if (!appOrigin) {
    return new Response("APP_ORIGIN is not configured", { status: 503 });
  }

  const incomingURL = new URL(request.url);
  const targetURL = new URL(appOrigin);
  const clientIP = request.headers.get("cf-connecting-ip");

  targetURL.pathname = incomingURL.pathname;
  targetURL.search = incomingURL.search;

  const upstreamRequest = new Request(targetURL, request);

  upstreamRequest.headers.set("x-forwarded-host", incomingURL.host);
  upstreamRequest.headers.set("x-forwarded-proto", incomingURL.protocol.slice(0, -1));
  if (clientIP) upstreamRequest.headers.set("x-client-ip", clientIP);

  const response = await fetch(upstreamRequest, { redirect: "manual" });

  return rewriteAppLocation(response, appOrigin);
};

const isLandingAsset = (pathname: string): boolean => {
  return pathname.startsWith("/_landing/") || LANDING_FILES.has(pathname);
};

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const wantsLanding = url.searchParams.get("landing") === "1";

    if (url.pathname === "/" && isPageRequest(request)) {
      if (!wantsLanding) {
        const workspacePath = await getWorkspacePath(request, env);

        if (workspacePath) {
          return new Response(null, {
            status: 302,
            headers: {
              "cache-control": "private, no-store",
              "location": workspacePath,
              "vary": "Cookie"
            }
          });
        }
      }

      return serveLanding(request, env);
    }

    if (url.pathname === "/docs" || url.pathname === "/docs/") {
      url.pathname = "/docs/overview/";

      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname.startsWith("/docs/")) {
      return serveDocs(request, env);
    }

    if (isLandingAsset(url.pathname)) {
      return env.LANDING.fetch(request);
    }

    if (LANDING_PAGES.has(url.pathname) && isPageRequest(request)) {
      return env.LANDING.fetch(request);
    }

    return serveApp(request, env);
  }
};

export default worker;
