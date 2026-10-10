import { createSignal } from "solid-js";
import { type JSONValue } from "./protocol";
import { ExtensionRequestError, request } from "./requests";

interface ExtensionContext {
  permissions: string[];
  backend: string | null;
  configuration: Record<string, JSONValue>;
}
interface SessionMessage {
  token: string | null;
  extensionID: string;
  instance: string;
}
interface APIFetchResult {
  status: number;
  contentType: string;
  body: string;
}

/** The origin `apiFetch` accepts; use it as the SDK `baseURL`. */
const EXTENSION_API_URL = "https://api.andesine.invalid";
const SESSION_WAIT = 10_000;
const [permissions, setPermissions] = createSignal<string[]>([]);
const [backendURL, setBackendURL] = createSignal<string | null>(null);
const [session, setSession] = createSignal<string | null>(null);
const [configuration, setConfiguration] = createSignal<Record<string, JSONValue>>({});

let identity = { extensionID: "", instance: "" };

const updateContext = (context: ExtensionContext): void => {
  setPermissions(context.permissions);
  setBackendURL(context.backend);
  setConfiguration(context.configuration);
};
const updateSession = (message: SessionMessage): void => {
  identity = { extensionID: message.extensionID, instance: message.instance };
  setSession(message.token);
};
/** The non-secret configuration values with defaults (reactive); only the backend reads secrets. */
const useConfiguration = <T extends Record<string, JSONValue> = Record<string, JSONValue>>() => {
  return configuration as () => Partial<T>;
};
/** The member's effective permissions for this extension (reactive), e.g. `read:entries`. */
const usePermissions = () => permissions;
/** Whether the effective permissions include `permission`; a write permission includes its read. */
const hasPermission = (permission: string): boolean => {
  const write = permission.startsWith("read:") ? permission.slice(5) : null;

  return permissions().some((granted) => granted === permission || granted === write);
};
/**
 * SDK `fetch` that calls Andesine with the member's session; forbidden operations return HTTP 403.
 * @example createClient({ baseURL: EXTENSION_API_URL, fetch: apiFetch })
 */
const apiFetch: typeof fetch = async (input, init) => {
  const outgoing = new Request(input, init);
  const url = new URL(outgoing.url);
  const hasBody = !["GET", "HEAD"].includes(outgoing.method);

  if (url.origin !== EXTENSION_API_URL) {
    throw new TypeError(`apiFetch only accepts ${EXTENSION_API_URL} URLs`);
  }

  try {
    const result = (await request("api.fetch", {
      method: outgoing.method,
      path: `${url.pathname}${url.search}`,
      ...(hasBody && { body: await outgoing.text() })
    })) as unknown as APIFetchResult;

    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": result.contentType }
    });
  } catch (error) {
    if (!(error instanceof ExtensionRequestError) || error.code !== "forbidden") throw error;

    return Response.json(
      { code: "FORBIDDEN", message: "The extension cannot call this operation" },
      { status: 403 }
    );
  }
};
const waitForSession = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const token = session();

      if (token) {
        resolve(token);
      } else if (Date.now() - started > SESSION_WAIT) {
        reject(new ExtensionRequestError("unavailable", "No backend session is available"));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
};
/** The extension's own backend, as declared in the manifest. */
const backend = {
  /**
   * Fetches a backend path with `Authorization`, `Andesine-Extension`, and `Andesine-Instance`
   * headers (CORS must allow them); verify them with `verifySession` of `@andesine/sdk/extensions`.
   */
  async fetch(path: string, init?: RequestInit): Promise<Response> {
    const base = backendURL();

    if (!base) throw new ExtensionRequestError("unavailable", "The extension has no backend");

    const root = base.endsWith("/") ? base : `${base}/`;
    const url = new URL(path.replace(/^\/+/, ""), root);

    if (!url.href.startsWith(root)) throw new TypeError("The path is outside the backend URL");

    const headers = new Headers(init?.headers);

    headers.set("Authorization", `Bearer ${await waitForSession()}`);
    headers.set("Andesine-Extension", identity.extensionID);
    headers.set("Andesine-Instance", identity.instance);

    return fetch(url, { ...init, headers, credentials: "omit", referrerPolicy: "no-referrer" });
  }
};

export {
  EXTENSION_API_URL,
  apiFetch,
  backend,
  hasPermission,
  updateContext,
  updateSession,
  useConfiguration,
  usePermissions
};
