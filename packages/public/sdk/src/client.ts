import { createAnswerStream } from "./answer-stream";
import { createContentClient, type ContentClient } from "./content-client";
import { serializeQuery } from "./query";
import createFetchClient from "openapi-fetch";
import { AndesineAPIError } from "./error";
import { createResources, type APIResources } from "./generated/resources";
import { fetchWithRetries } from "./retry";
import type { OperationDefinition, RequestOptions } from "./operation";

interface AndesineClient extends APIResources {
  content: ContentClient;
  /**
   * Bind published-content reads and pagination to an existing snapshot.
   * @param snapshotID - Snapshot ID returned by a published-content response.
   * @returns Content methods, including snapshot-aware entry and collection iterators.
   * No request is made until a method is called or an iterator is consumed.
   * @throws TypeError if a later request supplies a channel or a different snapshot ID.
   */
  atSnapshot(snapshotID: string): ContentClient;
}
interface ClientOptions {
  /** HTTP(S) API root, including any deployment prefix. Defaults to https://api.andesine.app. */
  baseURL?: string;
  /**
   * Bearer API key. Defaults to process.env.ANDESINE_API_KEY when available, read at creation.
   * Pass an empty string to disable this fallback. Keep private keys on your server;
   * the key is omitted on anonymous operations.
   */
  apiKey?: string;
  /** Fetch implementation to use instead of globalThis.fetch. */
  fetch?: typeof fetch;
  /** Default headers. Request headers override these; apiKey supplies Authorization. */
  headers?: HeadersInit;
  /** Timeout in milliseconds, including stream consumption. Defaults to 30,000; 0 disables it. */
  timeout?: number;
  /** Extra attempts for eligible GET failures. Defaults to 0. Other methods are never retried. */
  retries?: number;
}
interface RuntimeEnvironment {
  process?: { env?: { ANDESINE_API_KEY?: string } };
}
interface RuntimeOperation {
  parameters: { path: Record<string, unknown>; query: Record<string, unknown> };
  requestBody?: { content: { "application/json": unknown } };
  responses: { 200: { content: { "application/json": unknown } } };
}

type RuntimePaths = Record<
  string,
  Record<"get" | "post" | "put" | "patch" | "delete", RuntimeOperation>
>;

/**
 * Create a typed API client for a hosted or self-hosted Andesine instance.
 *
 * Methods return response data by default. Use response: "full" for status and headers,
 * including conditional reads that can return 304. Creation does not make a request.
 * @param config - Optional API root, credentials, transport, and request defaults.
 * Defaults to https://api.andesine.app and process.env.ANDESINE_API_KEY when available.
 * Runtimes without process.env use no default key. No environment files are loaded.
 * @returns API resources and helpers for published-content snapshots and pagination.
 * @throws TypeError if baseURL is not HTTP(S) or includes credentials, a query, or a fragment.
 * Request failures throw AndesineAPIError; abort and timeout reasons are preserved.
 * @example
 * const client = createClient();
 * const page = await client.content.get({ path: "/Docs/Welcome" });
 */
const createClient = (config: ClientOptions = {}): AndesineClient => {
  const baseURL = (config.baseURL ?? "https://api.andesine.app").replace(/\/+$/, "");
  const apiKey = config.apiKey ?? (globalThis as RuntimeEnvironment).process?.env?.ANDESINE_API_KEY;
  const url = new URL(baseURL);
  const fetcher = config.fetch ?? globalThis.fetch;

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new TypeError("baseURL must be an HTTP(S) URL without credentials, query, or fragment");
  }

  const request = async (
    definition: OperationDefinition,
    input: Record<string, unknown>,
    options: RequestOptions = {}
  ) => {
    const controller = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal;
    const timeout = options.timeout ?? config.timeout ?? 30_000;
    const retries = options.retries ?? config.retries ?? 0;
    const headers = new Headers(config.headers);
    const path = Object.fromEntries(definition.pathParams.map((key) => [key, input[key]]));
    const query = Object.fromEntries(definition.queryParams.map((key) => [key, input[key]]));
    const body = Object.fromEntries(
      Object.entries(input).filter(
        ([key]) => !definition.pathParams.includes(key) && !definition.queryParams.includes(key)
      )
    );
    const client = createFetchClient<RuntimePaths>({
      baseUrl: baseURL,
      querySerializer: serializeQuery
    });

    if (!Number.isFinite(timeout) || timeout < 0 || !Number.isInteger(retries) || retries < 0) {
      throw new TypeError("timeout and retries must be nonnegative; retries must be an integer");
    }
    if (query.channel !== undefined && query.snapshotID !== undefined) {
      throw new TypeError("Use either channel or snapshotID, not both");
    }

    for (const key of definition.pathParams) {
      if (input[key] === undefined || input[key] === null) {
        throw new TypeError(`Missing path parameter: ${key}`);
      }
    }

    new Headers(options.headers).forEach((value, key) => headers.set(key, value));

    if (definition.streaming && !headers.has("Accept")) {
      headers.set("Accept", "text/event-stream");
    }

    if (apiKey && !definition.anonymous) {
      headers.set("Authorization", `Bearer ${apiKey}`);
    }

    const timer =
      timeout > 0
        ? setTimeout(
            () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
            timeout
          )
        : undefined;

    let streamOwnsRequest = false;

    try {
      const result = await client.request(
        definition.method as keyof RuntimePaths[string],
        definition.path,
        {
          params: { path, query },
          headers,
          signal,
          body: definition.body ? body : undefined,
          parseAs: "stream",
          bodySerializer: definition.multipart
            ? (value) => {
                const form = new FormData();

                for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
                  if (item instanceof Blob) {
                    form.append(key, item);
                  } else if (item !== undefined) {
                    form.append(key, typeof item === "string" ? item : JSON.stringify(item));
                  }
                }

                return form;
              }
            : undefined,
          fetch: (request) =>
            fetchWithRetries(fetcher, request, definition.method === "get" ? retries : 0)
        }
      );

      const response = result.response;

      if (response.status === 304) {
        if (options.response !== "full") {
          throw new TypeError("Use response: 'full' for conditional requests that can return 304");
        }

        return { status: 304, headers: response.headers, data: undefined, notModified: true };
      }
      if (!response.ok) throw new AndesineAPIError(response, result.error);

      if (definition.streaming) {
        const data = createAnswerStream(response, {
          signal,
          cancel: () => controller.abort(),
          cleanup: () => {
            if (timer !== undefined) clearTimeout(timer);
          }
        });

        streamOwnsRequest = true;

        return options.response === "full"
          ? { status: response.status, headers: response.headers, data, notModified: false }
          : data;
      }

      const text = definition.binary || response.status === 204 ? undefined : await response.text();
      const data = definition.binary ? await response.blob() : text ? JSON.parse(text) : undefined;

      return options.response === "full"
        ? { status: response.status, headers: response.headers, data, notModified: false }
        : data;
    } finally {
      if (!streamOwnsRequest && timer !== undefined) clearTimeout(timer);
    }
  };
  const resources = createResources(request);

  return {
    ...resources,
    content: createContentClient(resources.content),
    atSnapshot(snapshotID: string) {
      return createContentClient(
        createResources((definition, input, options) => {
          const pinned =
            definition.path.startsWith("/content/") &&
            definition.queryParams.includes("snapshotID");

          if (
            pinned &&
            (input.channel !== undefined ||
              (input.snapshotID !== undefined && input.snapshotID !== snapshotID))
          ) {
            throw new TypeError("Cannot override a pinned snapshot");
          }

          return request(definition, pinned ? { ...input, snapshotID } : input, options);
        }).content
      );
    }
  };
};

export { createClient };
export type { AndesineClient, ClientOptions };
