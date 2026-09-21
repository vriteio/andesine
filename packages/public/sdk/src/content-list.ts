import type { components } from "./generated/schema";
import type {
  APIResponse,
  NotModifiedResponse,
  OperationInput,
  RawOperationOutput,
  RequestOptions
} from "./operation";
import type { WorkspaceTypeMap } from "./workspace";
import type { WorkspaceListContent } from "./workspace-output";

interface ContentListOperation<Workspace extends WorkspaceTypeMap = WorkspaceTypeMap> {
  <const Input extends OperationInput<"content.listEntries"> = Record<string, never>>(
    input: Input,
    options: RequestOptions & { response: "full" }
  ): Promise<APIResponse<ContentListOutput<Input, Workspace>> | NotModifiedResponse>;
  <const Input extends OperationInput<"content.listEntries"> = Record<string, never>>(
    input?: Input,
    options?: RequestOptions & { response?: "data" }
  ): Promise<ContentListOutput<Input, Workspace>>;
}

type FullContent<Input, Workspace extends WorkspaceTypeMap> = WorkspaceListContent<
  components["schemas"]["PublishedEntryContent"],
  Workspace,
  Input
>;
type ContentListOutput<Input, Workspace extends WorkspaceTypeMap = WorkspaceTypeMap> = Omit<
  RawOperationOutput<"content.listEntries">,
  "data"
> & {
  data: Array<
    Input extends { includeContent: true }
      ? FullContent<Input, Workspace>
      : "includeContent" extends keyof Input
        ? Input extends { includeContent?: false | undefined }
          ? components["schemas"]["PublishedEntrySummary"]
          : FullContent<Input, Workspace> | components["schemas"]["PublishedEntrySummary"]
        : components["schemas"]["PublishedEntrySummary"]
  >;
};

export type { ContentListOperation, ContentListOutput };
