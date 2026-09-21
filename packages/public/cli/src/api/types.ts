import type {
  AndesineClient,
  APIResponse,
  NotModifiedResponse,
  RequestOptions
} from "@andesine/sdk";

interface JSONSchema {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  description?: string;
  format?: string;
  contentMediaType?: string;
  enum?: unknown[];
  const?: unknown;
  [key: string]: unknown;
}
interface APIField {
  name: string;
  flag: string;
  location: "path" | "query" | "body" | "header";
  required: boolean;
  kind: "string" | "number" | "boolean" | "json" | "file";
  nullable: boolean;
  schema: JSONSchema;
}
interface APICommand {
  id: string;
  group: string;
  command: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  example?: Record<string, unknown>;
  security: Array<Record<string, string[]>>;
  fields: APIField[];
  response: "json" | "empty" | "binary" | "stream";
  conditional: boolean;
  pagination?: "cursor" | "snapshot";
}
interface APIOptions {
  input?: string;
  output?: string;
  format?: "json" | "text";
  timeout?: string;
  paginate?: boolean;
  full?: boolean;
  ifNoneMatch?: string;
  schema?: boolean;
  [key: string]: unknown;
}

type SDKOperation = (
  client: AndesineClient,
  input: Record<string, unknown>,
  options: RequestOptions & { response: "full" }
) => Promise<APIResponse<unknown> | NotModifiedResponse>;

export type { JSONSchema, APIField, APICommand, APIOptions, SDKOperation };
