import * as z from "zod";
import { createAbortableIterator, readEventData } from "./stream";

interface OpenAICompatibleClientConfig {
  apiKey: string;
  baseURL: string;
  embeddingDimensions: number;
  embeddingModel: string;
}

interface OpenAICompatibleMessage {
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "high" | "low" } }
      >;
  role: "assistant" | "system" | "user";
}

interface OpenAICompatibleCompletionInput {
  signal?: AbortSignal;
  maxTokens?: number;
  json?: boolean;
  messages: OpenAICompatibleMessage[];
  model: string;
  reasoningEffort?: "high" | "low" | "max" | "medium" | "minimal" | "none" | "xhigh";
}

interface OpenAICompatibleEmbedding {
  embedding: number[];
  index: number;
}

interface OpenAICompatibleEmbeddingResponse {
  data: OpenAICompatibleEmbedding[];
}

interface OpenAICompatibleCompletionResponse {
  choices: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const completionChunkType = z.object({
  choices: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      delta: z.object({ content: z.string().nullish() }),
      finish_reason: z.string().nullish()
    })
  ),
  error: z.unknown().optional()
});
const completionBody = (input: OpenAICompatibleCompletionInput) => ({
  model: input.model,
  messages: input.messages,
  max_completion_tokens: input.maxTokens || 1000,
  reasoning_effort: input.reasoningEffort,
  response_format: input.json ? { type: "json_object" } : undefined
});

const EMBEDDING_BATCH_SIZE = 64;
const OPENAI_REQUEST_TIMEOUT_MS = 60_000;

class OpenAICompatibleClient {
  private readonly config: OpenAICompatibleClientConfig;

  constructor(config: OpenAICompatibleClientConfig) {
    this.config = config;
  }

  private async getResponse(path: string, body: object, signal?: AbortSignal): Promise<Response> {
    const timeoutSignal = AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    requestSignal.throwIfAborted();
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: requestSignal
    });

    if (!response.ok) {
      const message = await response.text();

      throw new Error(message || `AI request failed with status ${response.status}`);
    }

    return response;
  }

  private async request<T>(path: string, body: object, signal?: AbortSignal): Promise<T> {
    const response = await this.getResponse(path, body, signal);

    return (await response.json()) as T;
  }

  private isEmbedding(value: unknown): value is OpenAICompatibleEmbedding {
    if (typeof value !== "object" || value === null) return false;

    const embedding = (value as OpenAICompatibleEmbedding).embedding;
    const index = (value as OpenAICompatibleEmbedding).index;

    return (
      Number.isInteger(index) &&
      Array.isArray(embedding) &&
      embedding.length === this.config.embeddingDimensions &&
      embedding.every((item) => typeof item === "number" && Number.isFinite(item))
    );
  }

  private async requestEmbeddings(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const result = await this.request<OpenAICompatibleEmbeddingResponse>(
      "/embeddings",
      {
        model: this.config.embeddingModel,
        input: texts,
        dimensions: this.config.embeddingDimensions
      },
      signal
    );

    if (!Array.isArray(result.data) || !result.data.every((item) => this.isEmbedding(item))) {
      throw new Error("The AI API returned an invalid embedding response");
    }

    const embeddings = [...result.data].sort((first, second) => first.index - second.index);
    const hasUnexpectedIndices = embeddings.some(({ index }, expectedIndex) => {
      return index !== expectedIndex;
    });

    if (embeddings.length !== texts.length || hasUnexpectedIndices) {
      throw new Error("The AI API returned an unexpected number of embeddings");
    }

    return embeddings.map(({ embedding }) => embedding);
  }

  async createEmbeddings(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);

      embeddings.push(...(await this.requestEmbeddings(batch, signal)));
    }

    return embeddings;
  }

  async createChatCompletion(input: OpenAICompatibleCompletionInput): Promise<string> {
    const result = await this.request<OpenAICompatibleCompletionResponse>(
      "/chat/completions",
      completionBody(input),
      input.signal
    );
    const content = result.choices?.[0]?.message?.content?.trim();

    if (!content) throw new Error("The AI API returned an empty completion");

    return content;
  }

  createChatCompletionStream(
    input: OpenAICompatibleCompletionInput
  ): AsyncIterableIterator<string> {
    return createAbortableIterator(
      async function* (this: OpenAICompatibleClient, callerSignal: AbortSignal) {
        const signal = AbortSignal.any([
          callerSignal,
          AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS)
        ]);
        const response = await this.getResponse(
          "/chat/completions",
          { ...completionBody(input), stream: true },
          signal
        );
        const contentType = response.headers
          .get("content-type")
          ?.split(";")[0]
          ?.trim()
          .toLowerCase();

        let hasContent = false;
        let finished = false;

        if (!response.body || contentType !== "text/event-stream") {
          await response.body?.cancel();
          throw new Error("The AI API did not return an event stream");
        }

        for await (const data of readEventData(response.body, signal)) {
          signal.throwIfAborted();

          if (data === "[DONE]") {
            if (!finished || !hasContent) {
              throw new Error("The AI API returned an empty or incomplete completion");
            }

            return;
          }

          const chunk = completionChunkType.safeParse(JSON.parse(data));

          if (!chunk.success || chunk.data.error !== undefined) {
            throw new Error("The AI API returned an invalid completion event");
          }

          const choice = chunk.data.choices.find(({ index }) => index === 0);

          // Usage-only events have no choices.
          if (!choice) continue;
          if (finished) throw new Error("The AI API sent content after finishing the completion");

          const content = choice.delta.content;

          if (content) {
            hasContent ||= Boolean(content.trim());
            yield content;
          }

          finished = choice.finish_reason != null;
        }

        throw new Error("The AI API stream ended before its completion marker");
      }.bind(this),
      input.signal
    );
  }
}

export { OpenAICompatibleClient };
export type {
  OpenAICompatibleClientConfig,
  OpenAICompatibleCompletionInput,
  OpenAICompatibleMessage
};
