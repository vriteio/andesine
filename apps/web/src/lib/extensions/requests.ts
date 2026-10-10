import {
  extensionProtocolLimits,
  extensionRequestParams,
  type ExtensionRequestErrorCode,
  type ExtensionRequestMethod,
  type ExtensionRequestParams,
  type ExtensionWorkerMessage
} from "@andesine/contracts/extensions";
import { ExtensionAPIForbiddenError, fetchExtensionAPI, type APIFetchContext } from "./api";
import { createStoragePerformers, ExtensionStorageError } from "./storage";
import { isDeclaredURL } from "./urls";

interface ExtensionHostActions {
  copyText(text: string, extension: string): Promise<void>;
  /** The name is a plain file name and the type a text media type. */
  downloadFile(
    file: Required<ExtensionRequestParams<"host.downloadFile">>,
    extension: string
  ): Promise<void>;
  /** `declared` URLs open directly; others need the member's confirmation. */
  openURL(url: string, declared: boolean, extension: string): Promise<void>;
  notify(notification: ExtensionRequestParams<"host.notify">, extension: string): void;
}
/** What a view's edit requests act on: its block action selection or its element. */
interface ExtensionViewTarget {
  replace?(content: unknown[]): boolean;
  insertAfter?(content: unknown[]): boolean;
  setElementProps?(props: Record<string, unknown>): boolean;
  close?(): void;
}
interface RequestError {
  code: ExtensionRequestErrorCode;
  message: string;
}
interface ExtensionRequestHandlerOptions {
  extensionID: string;
  name: string;
  sources: string[];
  getActions(): ExtensionHostActions | null;
  getViewTarget(viewID: string): ExtensionViewTarget | undefined;
  getAPIContext(): APIFetchContext;
  respond(id: number, outcome?: { error?: RequestError; result?: unknown }): void;
}
interface ExtensionRequestHandler {
  handle(request: Extract<ExtensionWorkerMessage, { type: "request" }>): Promise<void>;
  /** Records a user interaction in the extension's views; host actions need a recent one. */
  recordInteraction(): void;
  hasRecentInteraction(): boolean;
}
interface RateLimit {
  requests: number;
  window: number;
  recent: number[];
}

type RequestPerformers = {
  [M in ExtensionRequestMethod]: (params: ExtensionRequestParams<M>) => unknown;
};

// Browsers keep user activation for about five seconds.
const INTERACTION_WINDOW = 5_000;
const INTERACTIVE_METHODS = new Set<ExtensionRequestMethod>([
  "host.copyText",
  "host.downloadFile",
  "host.openURL",
  "editor.setElementProps"
]);

/** A plain file name: no paths, control characters, reserved characters, or leading dots. */
const sanitizeFileName = (name: string): string => {
  const sanitized = name
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "-")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, 200);

  return sanitized || "download.txt";
};
const consume = (limit: RateLimit, now: number): boolean => {
  while (limit.recent.length && now - limit.recent[0] > limit.window) limit.recent.shift();

  if (limit.recent.length >= limit.requests) return false;

  limit.recent.push(now);

  return true;
};
const rejectEdit = (): never => {
  throw new Error("The edit was rejected");
};
const createRequestHandler = (options: ExtensionRequestHandlerOptions): ExtensionRequestHandler => {
  const actionLimit: RateLimit = { requests: 10, window: 10_000, recent: [] };
  const editLimit: RateLimit = { requests: 30, window: 10_000, recent: [] };
  const apiLimit: RateLimit = { requests: 100, window: 10_000, recent: [] };

  let lastInteraction = 0;
  let pending = 0;

  const getError = (method: ExtensionRequestMethod, now: number): RequestError | null => {
    const limits = { host: actionLimit, api: apiLimit, storage: apiLimit };
    const limit = limits[method.split(".")[0] as keyof typeof limits] ?? editLimit;
    const isInteractive = INTERACTIVE_METHODS.has(method);

    if (pending >= extensionProtocolLimits.pendingRequests || !consume(limit, now)) {
      return { code: "too_many_requests", message: "Too many requests" };
    }

    if (isInteractive && now - lastInteraction > INTERACTION_WINDOW) {
      return {
        code: "user_interaction_required",
        message: "This request needs a user interaction"
      };
    }

    return null;
  };
  const getPerformers = (actions: ExtensionHostActions | null): RequestPerformers => {
    const requireActions = () => actions ?? rejectEdit();

    return {
      "host.copyText": ({ text }) => requireActions().copyText(text, options.name),
      "host.downloadFile": (file) => {
        const name = sanitizeFileName(file.name);
        const type = file.type ?? "text/plain";

        return requireActions().downloadFile({ ...file, name, type }, options.name);
      },
      "host.openURL": ({ url }) => {
        return requireActions().openURL(url, isDeclaredURL(url, options.sources), options.name);
      },
      "host.notify": (notification) => requireActions().notify(notification, options.name),
      "editor.replace": ({ viewID, content }) => {
        if (!options.getViewTarget(viewID)?.replace?.(content)) rejectEdit();
      },
      "editor.insertAfter": ({ viewID, content }) => {
        if (!options.getViewTarget(viewID)?.insertAfter?.(content)) rejectEdit();
      },
      "editor.setElementProps": ({ viewID, props }) => {
        if (!options.getViewTarget(viewID)?.setElementProps?.(props)) rejectEdit();
      },
      "view.close": ({ viewID }) => (options.getViewTarget(viewID)?.close ?? rejectEdit)(),
      "api.fetch": (params) => fetchExtensionAPI(params, options.getAPIContext()),
      ...createStoragePerformers(options.extensionID)
    };
  };

  return {
    async handle(request) {
      const params = extensionRequestParams[request.method].safeParse(request.params);
      const actions = options.getActions();
      const isUnavailable = request.method.startsWith("host.") && !actions;

      if (!params.success) {
        options.respond(request.id, {
          error: { code: "invalid_request", message: "Invalid parameters" }
        });

        return;
      }

      const error = isUnavailable
        ? { code: "unavailable" as const, message: "Unavailable" }
        : getError(request.method, Date.now());

      if (error) {
        options.respond(request.id, { error });

        return;
      }

      const perform = getPerformers(actions)[request.method] as (params: unknown) => unknown;

      pending += 1;

      try {
        options.respond(request.id, { result: await perform(params.data) });
      } catch (error) {
        const code = error instanceof ExtensionAPIForbiddenError ? "forbidden" : "failed";
        const message =
          error instanceof ExtensionStorageError ? error.message : "The request was rejected";

        options.respond(request.id, { error: { code, message } });
      } finally {
        pending -= 1;
      }
    },
    recordInteraction() {
      lastInteraction = Date.now();
    },
    hasRecentInteraction() {
      return Date.now() - lastInteraction <= INTERACTION_WINDOW;
    }
  };
};

export { createRequestHandler, sanitizeFileName };
export type { ExtensionHostActions, ExtensionViewTarget };
