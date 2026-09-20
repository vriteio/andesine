import type { components } from "./generated/schema";
import type {
  APIResponse,
  NotModifiedResponse,
  OperationInput,
  OperationOutput,
  RequestOptions
} from "./operation";

interface ContentListOperation {
  <const Input extends OperationInput<"content.listEntries"> = Record<string, never>>(
    input: Input,
    options: RequestOptions & { response: "full" }
  ): Promise<APIResponse<ContentListOutput<Input>> | NotModifiedResponse>;
  <const Input extends OperationInput<"content.listEntries"> = Record<string, never>>(
    input?: Input,
    options?: RequestOptions & { response?: "data" }
  ): Promise<ContentListOutput<Input>>;
}

type ContentListOutput<Input> = Omit<OperationOutput<"content.listEntries">, "data"> & {
  data: Array<
    Input extends { includeContent: true }
      ? components["schemas"]["PublishedEntryContent"]
      : "includeContent" extends keyof Input
        ? Input extends { includeContent?: false | undefined }
          ? components["schemas"]["PublishedEntrySummary"]
          : | components["schemas"]["PublishedEntryContent"]
            | components["schemas"]["PublishedEntrySummary"]
        : components["schemas"]["PublishedEntrySummary"]
  >;
};

export type { ContentListOperation, ContentListOutput };
