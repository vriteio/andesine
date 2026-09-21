import {
  createClient,
  paginatePages,
  type AndesineClient,
  type OperationInput,
  type RequestOptions,
  type AnswerEvent
} from "@andesine/sdk";
import { authenticatedClient } from "../auth/client";
import type { CommandContext } from "../context";
import { CLIError, exitCodes } from "../errors";
import { workspaceIDSchema } from "../config/schema";
import { readInput } from "./input";
import { bindings } from "./bindings";
import { reportAPIError } from "./errors";
import { writeBinary } from "./binary";
import type { APICommand, APIOptions } from "./types";

interface CursorPage {
  data: unknown[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

const isPage = (value: unknown): value is CursorPage => {
  if (
    !value ||
    typeof value !== "object" ||
    !("data" in value) ||
    !Array.isArray(value.data) ||
    !("pagination" in value)
  ) {
    return false;
  }

  const pagination = value.pagination;

  return Boolean(
    pagination &&
    typeof pagination === "object" &&
    "hasMore" in pagination &&
    typeof pagination.hasMore === "boolean" &&
    "nextCursor" in pagination &&
    (pagination.nextCursor === null || typeof pagination.nextCursor === "string")
  );
};

const pages = async function* (
  command: APICommand,
  client: AndesineClient,
  input: Record<string, unknown>,
  options: RequestOptions
): AsyncGenerator<unknown> {
  if (command.id === "content.listCollections") {
    yield* client.content.paginateCollectionPages(
      input as OperationInput<"content.listCollections">,
      { ...options, response: "data" }
    );
    return;
  }

  if (command.id === "content.listEntries") {
    yield* client.content.paginateEntryPages(input as OperationInput<"content.listEntries">, {
      ...options,
      response: "data"
    });
    return;
  }

  const invoke = bindings[command.id as keyof typeof bindings];

  yield* paginatePages(
    async (cursor) => {
      const result = await invoke(client, { ...input, cursor }, { ...options, response: "full" });

      if (!isPage(result.data)) {
        throw new CLIError("The server returned an invalid paginated response.");
      }

      return result.data;
    },
    { cursor: typeof input.cursor === "string" ? input.cursor : undefined }
  );
};

/** Use the SDK for all transport; command metadata and execution bindings are bundled locally. */
const executeAPI = async (
  command: APICommand,
  options: APIOptions,
  context: CommandContext
): Promise<void> => {
  const { output, signal } = context;
  const timeout = options.timeout === undefined ? 30_000 : Number(options.timeout);

  if (!Number.isFinite(timeout) || timeout < 0 || options.timeout?.trim() === "") {
    throw new CLIError(
      "--timeout must be a nonnegative number of milliseconds; 0 disables it.",
      exitCodes.usage
    );
  }

  if (options.paginate && !command.pagination) {
    throw new CLIError("This operation does not support cursor pagination.", exitCodes.usage);
  }

  if (options.paginate && options.ifNoneMatch !== undefined) {
    throw new CLIError("Conditional headers cannot be combined with --paginate.", exitCodes.usage);
  }

  if (options.paginate && options.full) {
    throw new CLIError(
      "--full cannot be combined with --paginate; pages already retain pagination and snapshot metadata.",
      exitCodes.usage
    );
  }

  if (command.response === "binary" && !options.output) {
    throw new CLIError("Specify --output <file> or --output - for binary data.", exitCodes.usage);
  }

  if (options.output && command.response !== "binary") {
    throw new CLIError("Use shell redirection for JSON and text output.", exitCodes.usage);
  }

  if (options.format === "text" && command.response !== "stream") {
    throw new CLIError("--format text is only available for AI answer streams.", exitCodes.usage);
  }

  const input = await readInput(command, options, signal);
  const headers = new Headers();

  for (const field of command.fields) {
    if (field.location !== "header" || !Object.hasOwn(input, field.name)) continue;

    headers.set(field.name, String(input[field.name]));
    delete input[field.name];
  }

  if (options.ifNoneMatch !== undefined) headers.set("If-None-Match", options.ifNoneMatch);

  const request: RequestOptions = { signal, timeout, retries: 0, headers };

  await output.heading(`Andesine · ${command.summary}`);

  try {
    const anonymous =
      command.security.length === 0 ||
      command.security.some((requirement) => !Object.keys(requirement).length);
    const auth = anonymous
      ? {
          client: createClient({
            baseURL: context.config.baseURL,
            fetch: (input, init) => fetch(input, { ...init, redirect: "error" })
          }),
          source: "anonymous"
        }
      : await authenticatedClient(context);
    const acceptsAPIKey = command.security.some((requirement) =>
      Object.hasOwn(requirement, "apiKey")
    );

    if (auth.source === "environment" && !acceptsAPIKey) {
      throw new CLIError(
        "This operation requires OAuth login. Unset ANDESINE_API_KEY and run andesine auth login."
      );
    }

    const requiresWorkspace =
      (auth.source === "file" || auth.source === "keyring") &&
      command.fields.some(
        (field) => field.location === "header" && field.name === "x-workspace-id"
      );

    if (requiresWorkspace) {
      const workspaceID = headers.get("x-workspace-id") ?? context.config.workspaceID;

      if (workspaceID === undefined) {
        throw new CLIError(
          "No workspace selected. Run andesine init, pass --workspace <id>, or set ANDESINE_WORKSPACE_ID. Use andesine api workspaces list to find a workspace ID.",
          exitCodes.usage
        );
      }

      if (!workspaceIDSchema.safeParse(workspaceID).success) {
        throw new CLIError("The workspace must be a workspace ID (ws_…).", exitCodes.usage);
      }

      headers.set("x-workspace-id", workspaceID);
    }

    if (options.paginate) {
      let count = 0;

      for await (const page of pages(command, auth.client, input, request)) {
        signal.throwIfAborted();
        await output.json(page);
        count += 1;
      }

      await output.success(`Received ${count} page${count === 1 ? "" : "s"}.`);
      return;
    }

    const invoke = bindings[command.id as keyof typeof bindings];
    const response = await output.progress(
      "Sending request",
      () => invoke(auth.client, input, { ...request, response: "full" }),
      "Response received"
    );

    if (response.notModified) {
      await output.json({
        status: 304,
        notModified: true,
        etag: response.headers.get("etag"),
        ...(options.full ? { headers: Object.fromEntries(response.headers), data: null } : {})
      });
      return;
    }

    if (options.full) {
      await output.json({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        data: response.data ?? null,
        notModified: false
      });
      return;
    }

    if (command.response === "stream") {
      const events = response.data as AsyncIterable<AnswerEvent>;

      for await (const event of events) {
        signal.throwIfAborted();
        if (options.format !== "text") await output.json(event);
        else if (event.type === "textDelta") await output.text(event.text);
      }

      await output.success("Answer complete.");
    } else if (command.response === "binary") {
      await writeBinary(response.data, options.output!, signal);
      await output.success(
        options.output === "-" ? "Download complete." : `Saved ${options.output}.`
      );
    } else if (command.response === "empty" || response.data === undefined) {
      await output.success(`Request completed (${response.status}).`);
    } else {
      await output.json(response.data);
    }
  } catch (error) {
    await reportAPIError(context, error);
  }
};

export { executeAPI };
