import type {
  ExtensionDevelopmentUpload,
  ExtensionStateResult,
  ExtensionWebhookDeliveryDetails
} from "@andesine/contracts/extensions";
import { getAccessToken } from "../../auth/client";
import type { CommandContext } from "../../context";
import { CLIError, exitCodes } from "../../errors";

interface DevelopmentClient {
  workspaceID: string;
  upload(input: ExtensionDevelopmentUpload): Promise<ExtensionStateResult>;
  stop(extensionID: string, signal?: AbortSignal): Promise<ExtensionStateResult>;
  remove(extensionID: string): Promise<ExtensionStateResult>;
  sendTest(extensionID: string, webhookID: string, type: string): Promise<{ deliveryID: string }>;
  getDelivery(
    extensionID: string,
    webhookID: string,
    deliveryID: string
  ): Promise<ExtensionWebhookDeliveryDetails>;
}

/** A failure that the instance reported, as opposed to a failed build. */
class InstanceError extends CLIError {}

// Hosted instances never enable development; these hosts serve only a local stack.
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const LOCAL_DOMAINS = [".localhost", ".local", ".test"];

const isLocalInstance = (baseURL: string): boolean => {
  const { hostname } = new URL(baseURL);

  return (
    LOCAL_HOSTS.includes(hostname) || LOCAL_DOMAINS.some((domain) => hostname.endsWith(domain))
  );
};
const describeFailure = (status: number, body: unknown): string => {
  const message = (body as { message?: unknown } | null)?.message;
  // The default message (no route, or the endpoints are off) differs from a missing extension.
  const isDevelopmentOff = status === 404 && (body === null || message === "Not Found");

  if (isDevelopmentOff) {
    return "The instance has no development endpoints. Set PUBLIC_EXTENSIONS_ENABLED=true and EXTENSIONS_DEVELOPMENT_ENABLED=true on the local backend.";
  }

  return typeof message === "string" ? message : `The request failed (HTTP ${status}).`;
};

/** Client for the local instance's development endpoints, which are outside the public API. */
const createDevelopmentClient = (context: CommandContext): DevelopmentClient => {
  const { baseURL, workspaceID } = context.config;

  if (!isLocalInstance(baseURL)) {
    throw new CLIError(
      `${baseURL} is not a local instance. Extension development needs a local stack (localhost, *.localhost, *.local, or *.test); use --base-url.`,
      exitCodes.usage
    );
  }

  if (process.env.ANDESINE_API_KEY !== undefined) {
    throw new CLIError(
      "API keys cannot develop extensions. Unset ANDESINE_API_KEY and run andesine auth login.",
      exitCodes.usage
    );
  }

  if (!workspaceID) {
    throw new CLIError(
      "Select a workspace with --workspace or ANDESINE_WORKSPACE_ID.",
      exitCodes.usage
    );
  }

  const request = async <Result>(
    method: string,
    path: string,
    body?: unknown,
    signal = context.signal
  ): Promise<Result> => {
    const response = await fetch(`${baseURL}/extensions${path}`, {
      method,
      redirect: "error",
      signal,
      headers: {
        "authorization": `Bearer ${await getAccessToken({ ...context, signal })}`,
        "x-workspace-id": workspaceID,
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) throw new InstanceError(describeFailure(response.status, result));

    return result as Result;
  };
  const webhookPath = (extensionID: string, webhookID: string) => {
    return `/${extensionID}/webhooks/${encodeURIComponent(webhookID)}`;
  };

  return {
    workspaceID,
    upload: (input) => request("PUT", "/development", input),
    stop: (extensionID, signal) => {
      return request("POST", `/development/${extensionID}/stop`, undefined, signal);
    },
    remove: (extensionID) => request("DELETE", `/development/${extensionID}`),
    sendTest: (extensionID, webhookID, type) => {
      return request("POST", `${webhookPath(extensionID, webhookID)}/test`, { type });
    },
    getDelivery: (extensionID, webhookID, deliveryID) => {
      return request("GET", `${webhookPath(extensionID, webhookID)}/deliveries/${deliveryID}`);
    }
  };
};

export { InstanceError, createDevelopmentClient };
export type { DevelopmentClient };
