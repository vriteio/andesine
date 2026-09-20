import type { ContentListOperation } from "./content-list";
import type { WithSelectors } from "./selectors";
import type { operations } from "./generated/schema";

interface RequestOptions {
  /** Cancel the request or stream, preserving the signal's abort reason. */
  signal?: AbortSignal;
  /** Override the client timeout in milliseconds; 0 disables it. Includes stream consumption. */
  timeout?: number;
  /** Override GET retry attempts. Defaults to the client setting; other methods never retry. */
  retries?: number;
  /** Headers merged over client headers. The configured API key supplies Authorization. */
  headers?: HeadersInit;
  /** Return data by default, or status/headers/data with "full". Required for possible 304s. */
  response?: "data" | "full";
}
interface APIResponse<T> {
  status: number;
  headers: Headers;
  data: T;
  notModified: false;
}
interface NotModifiedResponse {
  status: 304;
  headers: Headers;
  data: undefined;
  notModified: true;
}
interface OperationDefinition {
  streaming?: boolean;
  method: string;
  path: string;
  pathParams: string[];
  queryParams: string[];
  body: boolean;
  multipart: boolean;
  binary: boolean;
  anonymous: boolean;
}
interface Requester {
  (
    definition: OperationDefinition,
    input: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<unknown>;
}
interface StandardOperation<K extends keyof operations> {
  (
    input: OperationInput<K>,
    options: RequestOptions & { response: "full" }
  ): Promise<APIResponse<OperationOutput<K>> | NotModifiedResponse>;
  (
    ...args: Record<string, never> extends OperationInput<K>
      ? [input?: OperationInput<K>, options?: RequestOptions & { response?: "data" }]
      : [input: OperationInput<K>, options?: RequestOptions & { response?: "data" }]
  ): Promise<OperationOutput<K>>;
}

interface StreamOperation<K extends keyof operations> {
  (
    input: OperationInput<K>,
    options: RequestOptions & { response: "full" }
  ): Promise<APIResponse<OperationOutput<K>>>;
  (
    input: OperationInput<K>,
    options?: RequestOptions & { response?: "data" }
  ): Promise<OperationOutput<K>>;
}

type StreamContent<K extends keyof operations> = Responses<K>[Extract<
  keyof Responses<K>,
  200
>] extends { content: { "text/event-stream": infer Frames } }
  ? Frames
  : never;
type StreamEvent<K extends keyof operations> =
  Extract<StreamContent<K>, { event: "message" }> extends { data: infer Event } ? Event : never;
type Operation<K extends keyof operations> = [StreamContent<K>] extends [never]
  ? K extends "content.listEntries"
    ? ContentListOperation
    : StandardOperation<K>
  : StreamOperation<K>;

type Content<T> = T extends { content: infer C } ? C[keyof C] : never;
type Parameters<T, K extends string> = T extends { parameters: infer P }
  ? K extends keyof P
    ? [NonNullable<P[K]>] extends [never]
      ? unknown
      : NonNullable<P[K]>
    : unknown
  : unknown;
type Body<T> = T extends { requestBody?: infer B }
  ? [Content<NonNullable<B>>] extends [never]
    ? unknown
    : Content<NonNullable<B>>
  : unknown;
type OperationInput<K extends keyof operations> = WithSelectors<
  K,
  Parameters<operations[K], "path"> & Parameters<operations[K], "query"> & Body<operations[K]>
>;
type Responses<K extends keyof operations> = operations[K]["responses"];
type SuccessContent<K extends keyof operations> = Content<
  Responses<K>[Extract<keyof Responses<K>, 200 | 201 | 202 | 203 | 206>]
>;
type OperationError<K extends keyof operations> = K extends keyof operations
  ? Extract<Content<Responses<K>[keyof Responses<K>]>, { defined: true; code: string }>
  : never;
type APIErrorBody = OperationError<keyof operations>;
type APIErrorCode = APIErrorBody["code"];
type APIErrorData<C extends APIErrorCode> = Extract<APIErrorBody, { code: C }>["data"];
type OperationOutput<K extends keyof operations> = [StreamContent<K>] extends [never]
  ? [SuccessContent<K>] extends [never]
    ? void
    : SuccessContent<K>
  : AsyncIterableIterator<StreamEvent<K>>;

const operation = <K extends keyof operations>(
  request: Requester,
  definition: OperationDefinition
): Operation<K> => {
  return ((input: Record<string, unknown>, options?: RequestOptions) => {
    return request(definition, input || {}, options);
  }) as Operation<K>;
};

export { operation };
export type {
  APIResponse,
  APIErrorBody,
  APIErrorCode,
  APIErrorData,
  OperationError,
  NotModifiedResponse,
  Operation,
  OperationDefinition,
  OperationInput,
  OperationOutput,
  Requester,
  RequestOptions
};
