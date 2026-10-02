import { AndesineAPIError, createClient } from "@andesine/sdk";
import type { z } from "zod";
import type { AndesineSourceConfig, PagesConfig } from "../config";
import { loadAndesineSource } from "../sources/andesine/stored";
import { getAPIKey } from "../sources/andesine/read";
import type { PageResolver } from "./items";

interface RequestOptions<T> {
  schema: z.ZodType<T>;
  /** Largest accepted body, in characters. */
  maxSize: number;
  /** Time limit for the upstream API, in milliseconds. */
  timeout: number;
}

interface AndesineRequest<T> {
  body: T;
  source: AndesineSourceConfig;
  client: ReturnType<typeof createClient>;
  signal: AbortSignal;
}

type RequestResult<T> = { request: AndesineRequest<T> } | { response: Response };

const resolvers = new Map<string, Promise<PageResolver>>();

const parseJSON = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response => {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", ...headers }
  });
};
/** Reads a body of up to `maxSize` characters; larger bodies give `undefined`. */
const readText = async (request: Request, maxSize: number): Promise<string | undefined> => {
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();

  let text = "";

  if (!reader) return text;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    text += decoder.decode(chunk.value, { stream: true });

    if (text.length > maxSize) {
      await reader.cancel();

      return undefined;
    }
  }

  return `${text}${decoder.decode()}`;
};
/**
 * Checks the method, the origin and the body of a browser request for an Andesine source.
 * The browser can only choose a configured source; the API key stays on the server.
 */
const readRequest = async <T extends { source: string }>(
  request: Request,
  config: PagesConfig,
  options: RequestOptions<T>
): Promise<RequestResult<T>> => {
  const origin = request.headers.get("origin");
  const allowed = [new URL(request.url).origin, new URL(config.site).origin];

  if (request.method !== "POST") return { response: json({ error: "Use POST." }, 405) };

  if (origin && !allowed.includes(origin)) {
    return { response: json({ error: "Origin not allowed." }, 403) };
  }

  const text = await readText(request, options.maxSize);
  const body = text === undefined ? undefined : options.schema.safeParse(parseJSON(text));
  const source = config.sources.find((item): item is AndesineSourceConfig => {
    return item.type === "andesine" && item.id === body?.data?.source;
  });

  if (!body?.success || !source) return { response: json({ error: "Invalid request." }, 400) };

  try {
    return {
      request: {
        body: body.data,
        source,
        client: createClient({ baseURL: source.apiURL, apiKey: getAPIKey(source) }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(options.timeout)])
      }
    };
  } catch (error) {
    console.error(error);

    return { response: json({ error: "The server is not configured." }, 502) };
  }
};
/**
 * Maps results to page URLs, from the built pages. Results for pages that were published after
 * the build have no URL and are left out. The pages do not change, so each source loads once.
 */
const createPageResolver = (source: AndesineSourceConfig, base: string): Promise<PageResolver> => {
  if (!resolvers.has(source.id)) {
    const resolver = loadAndesineSource(source, base).then(({ pages }): PageResolver => {
      const shown = new Map(
        pages.filter((page) => !page.searchHidden).map((page) => [page.id, page])
      );

      return (result) => shown.get(result.entryID)?.href;
    });

    resolvers.set(source.id, resolver);
    resolver.catch(() => resolvers.delete(source.id));
  }

  return resolvers.get(source.id)!;
};
/** Maps API failures to a response; only unexpected failures are logged. */
const toErrorResponse = (
  error: unknown,
  messages: { limited: string; failed: string }
): Response => {
  const limited = error instanceof AndesineAPIError && error.status === 429;

  if (!limited) console.error(error);

  return limited ? json({ error: messages.limited }, 429) : json({ error: messages.failed }, 502);
};

export { readRequest, createPageResolver, toErrorResponse, json };
export type { AndesineRequest };
