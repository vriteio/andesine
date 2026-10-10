import { type ExtensionRequestParams } from "@andesine/contracts/extensions";
import { type KeyPermission } from "@andesine/contracts/entities";
import { hasPermission } from "@andesine/contracts/permissions";

interface APIRoute {
  method: string;
  pattern: RegExp;
  /** API-key requirements; `true` allows any key. */
  key: KeyPermission[] | true;
}
interface APIFetchResult {
  status: number;
  contentType: string;
  body: string;
}
interface APIFetchContext {
  apiURL: string;
  /** The member's effective permissions for the extension. */
  permissions: string[];
  workspaceID: string | null;
}

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const REQUEST_TIMEOUT = 30_000;

let routes: Promise<APIRoute[]> | null = null;

class ExtensionAPIForbiddenError extends Error {}

const toPattern = (path: string): RegExp => {
  const template = path.replace(/\/+$/, "") || "/";
  const source = template
    .split(/(\{[^}]+\})/)
    .map((part) => (part.startsWith("{") ? "[^/]+" : part.replace(/[.*+?^$()|[\]\\]/g, "\\$&")))
    .join("");

  return new RegExp(`^${source}/?$`);
};
// The contract loads on the first API call, so the app bundle does not include it.
const loadRoutes = (): Promise<APIRoute[]> => {
  routes ??= Promise.all([
    import("@andesine/contracts/api"),
    import("@andesine/contracts/api/base")
  ]).then(([{ createAPIContract }, { isPublicAPI }]) => {
    const result: APIRoute[] = [];
    const walk = (router: Record<string, unknown>) => {
      for (const value of Object.values(router)) {
        const definition = (
          value as { "~orpc"?: { meta: never; route: { method?: string; path?: string } } }
        )["~orpc"];

        if (!definition) {
          walk(value as Record<string, unknown>);
        } else if (isPublicAPI(definition.meta) && definition.route.path) {
          const key = (definition.meta as { required: { key?: KeyPermission[] | true } }).required
            .key;

          if (key) {
            result.push({
              method: definition.route.method ?? "POST",
              pattern: toPattern(definition.route.path),
              key
            });
          }
        }
      }
    };

    walk(createAPIContract() as unknown as Record<string, unknown>);

    return result;
  });

  return routes;
};
/** Allows only public API-key operations within the member's effective permissions. */
const fetchExtensionAPI = async (
  params: ExtensionRequestParams<"api.fetch">,
  context: APIFetchContext
): Promise<APIFetchResult> => {
  const url = new URL(params.path, context.apiURL);
  const route = (await loadRoutes()).find((item) => {
    return item.method === params.method && item.pattern.test(url.pathname);
  });
  const isAllowed =
    route &&
    (route.key === true ||
      route.key.every((required) => {
        return context.permissions.some((granted) => hasPermission(granted, required));
      }));

  if (!isAllowed || url.origin !== new URL(context.apiURL).origin) {
    throw new ExtensionAPIForbiddenError("The extension cannot call this operation");
  }

  const response = await fetch(url, {
    method: params.method,
    body: params.body,
    credentials: "include",
    headers: {
      ...(params.body !== undefined && { "content-type": "application/json" }),
      ...(context.workspaceID && { "x-workspace-id": context.workspaceID })
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT)
  });
  const body = await response.text();

  if (body.length > MAX_RESPONSE_SIZE) throw new Error("The API response is too large");

  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "application/json",
    body
  };
};

export { ExtensionAPIForbiddenError, fetchExtensionAPI };
export type { APIFetchContext, APIFetchResult };
